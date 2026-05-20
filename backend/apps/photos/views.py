"""
apps/photos/views.py
Photo endpoints — upload pipeline, secure download, favorites.
"""

import logging
from django.conf import settings
from django.db import transaction
from rest_framework import status, filters
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from django.db.models import Exists, OuterRef
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.core.permissions import IsAdmin
from apps.core.exceptions import (
    ResourceNotFoundException,
    PaymentRequiredException,
    BusinessException,
)
from apps.galleries.models import Gallery
from apps.core.mongo import get_audit_log_collection
from .models import Photo, PhotoFavorite, PhotoStatus
from .serializers import (
    PhotoSerializer,
    PhotoListSerializer,
    PhotoUploadSerializer,
    SignedDownloadSerializer,
    FavoriteToggleSerializer,
)
from .services.storage import generate_download_token, verify_download_token, get_photo_urls, get_storage_service
from .tasks import process_watermark

logger = logging.getLogger(__name__)


class PhotoViewSet(ModelViewSet):
    """
    Photos scoped to a gallery.

    GET  /api/galleries/:gallery_id/photos/      — list photos
    GET  /api/photos/:id/                        — photo detail
    DELETE /api/photos/:id/                      — soft delete (admin only)
    POST /api/photos/:id/favorite/               — toggle favorite
    POST /api/photos/:id/download/               — get signed download URL
    """

    http_method_names = ["get", "delete", "post"]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "is_purchased"]
    ordering_fields = ["sort_order", "created_at", "size"]
    ordering = ["sort_order", "-created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Photo.objects.select_related("gallery__client").order_by("sort_order", "-created_at")

        gallery_id = self.kwargs.get("gallery_pk") or self.request.query_params.get("gallery_id")
        if gallery_id:
            qs = qs.filter(gallery_id=gallery_id)

        if not user.is_admin:
            # Client only sees their own gallery photos
            qs = qs.filter(gallery__client=user)

        return qs

    def get_queryset_with_favorites(self):
        """Annotate _user_favorited at the DB level via Exists() subquery.

        The previous approach iterated over the queryset in Python and set
        _user_favorited on each instance, but filter_queryset() always clones
        the queryset (clearing the result cache), so those attributes were lost
        before the serializer ever ran. Using annotate() pushes the flag into
        the SQL query itself, so it survives any subsequent cloning/filtering.
        """
        qs = self.get_queryset()
        user = self.request.user
        if user.is_authenticated:
            favorited_subquery = PhotoFavorite.objects.filter(
                user=user,
                photo=OuterRef("pk"),
            )
            qs = qs.annotate(_user_favorited=Exists(favorited_subquery))
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return PhotoListSerializer
        return PhotoSerializer

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        gallery_pk = self.kwargs.get("gallery_pk")
        if gallery_pk:
            # Validate gallery access
            try:
                gallery = Gallery.objects.get(id=gallery_pk)
            except Gallery.DoesNotExist:
                raise ResourceNotFoundException("Gallery not found.")
            if not request.user.is_admin and gallery.client != request.user:
                raise ResourceNotFoundException("Gallery not found.")

        qs = self.filter_queryset(self.get_queryset_with_favorites())

        # Filter by favorited status — not handled by DjangoFilterBackend because
        # is_favorited is a runtime annotation, not a model field.
        is_favorited_param = request.query_params.get("is_favorited")
        if is_favorited_param is not None:
            favorited_ids = set(
                PhotoFavorite.objects.filter(user=request.user).values_list("photo_id", flat=True)
            )
            if is_favorited_param.lower() in ("true", "1"):
                qs = qs.filter(id__in=favorited_ids)
            else:
                qs = qs.exclude(id__in=favorited_ids)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    def perform_destroy(self, instance):
        # Clean up storage files
        storage = get_storage_service()
        for field in ("original_file", "watermarked_file", "thumbnail_file"):
            path = getattr(instance, field, None)
            if path:
                try:
                    storage.delete(path)
                except Exception as e:
                    logger.warning("Failed to delete file %s: %s", path, e)
        instance.delete()  # Soft delete
        logger.info("Photo deleted: %s by %s", instance.id, self.request.user.id)

    # ── /photos/:id/download/ ─────────────────────────────────────────────

    @extend_schema(
        tags=["Photos"],
        summary="Gerar URL de download seguro",
        responses={200: SignedDownloadSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="download",
        permission_classes=[IsAuthenticated],
    )
    def download(self, request, pk=None):
        photo = self.get_object()

        if not request.user.is_admin and not photo.is_purchased:
            raise PaymentRequiredException()

        if photo.status != PhotoStatus.READY:
            raise BusinessException("Photo is not ready for download yet.")

        # Generate signed token
        token_data = generate_download_token(str(photo.id), str(request.user.id))

        # Build download URL
        download_url = request.build_absolute_uri(
            f"/api/photos/download/{token_data['token']}/"
        )

        # Audit log → MongoDB
        _log_download_event(photo, request)

        return Response({
            "url": download_url,
            "token": token_data["token"],
            "filename": photo.filename,
            "expires_at": token_data["expires_at"],
        })

    # ── /photos/:id/purchase/ ─────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="purchase")
    def purchase(self, request, pk=None):
        """Unlock a single photo for download using the access code."""
        photo = self.get_object()
        code = request.data.get("code", "").strip()
        expected = getattr(settings, "PURCHASE_ACCESS_CODE", "121212")
        if code != expected:
            raise BusinessException("Código de acesso inválido.")
        if not photo.is_purchased:
            photo.is_purchased = True
            photo.save(update_fields=["is_purchased"])
            logger.info("Photo purchased: %s by %s", photo.id, request.user.id)
        serializer = self.get_serializer(photo, context={"request": request})
        return Response(serializer.data)

    # ── /photos/:id/favorite/ ─────────────────────────────────────────────

    @extend_schema(
        tags=["Photos"],
        summary="Favoritar / desfavoritar foto",
        responses={200: FavoriteToggleSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="favorite",
        permission_classes=[IsAuthenticated],
    )
    def favorite(self, request, pk=None):
        photo = self.get_object()
        favorite, created = PhotoFavorite.objects.get_or_create(
            user=request.user, photo=photo
        )
        if not created:
            favorite.delete()
            is_favorited = False
        else:
            is_favorited = True

        return Response({"is_favorited": is_favorited})


# ─── Upload View ───────────────────────────────────────────────────────────────


class PhotoUploadView(APIView):
    """
    POST /api/photos/upload/
    Accepts multipart/form-data with one or more photo files.
    Validates MIME type, saves original, dispatches Celery watermark task.

    Only admins can upload photos.
    """

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAdmin]

    @extend_schema(
        tags=["Photos"],
        summary="Upload de fotos",
        description=(
            "Faz upload de uma ou mais fotos para uma galeria. "
            "A marca d'água é aplicada automaticamente de forma assíncrona. "
            "Aceita JPG, PNG e WebP. Limite: 50MB por arquivo."
        ),
        request=PhotoUploadSerializer,
        responses={202: PhotoSerializer(many=True)},
    )
    def post(self, request):
        gallery_id = request.data.get("gallery_id")
        if not gallery_id:
            return Response(
                {"error": {"code": "missing_field", "message": "gallery_id is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate gallery access
        try:
            gallery = Gallery.objects.get(id=gallery_id)
        except Gallery.DoesNotExist:
            raise ResourceNotFoundException("Gallery not found.")

        # Admin can upload to any gallery;
        # clients could upload to their own (disabled in prod — admin only)
        if not request.user.is_admin and gallery.client != request.user:
            raise ResourceNotFoundException("Gallery not found.")

        files = request.FILES.getlist("photo") or request.FILES.getlist("photos")
        if not files:
            return Response(
                {"error": {"code": "missing_field", "message": "At least one photo file is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_photos = []
        errors = []

        for file in files:
            try:
                photo = _process_single_upload(file, gallery, request.user)
                created_photos.append(photo)
            except Exception as e:
                logger.error("Upload failed for file %s: %s", file.name, e)
                errors.append({"filename": file.name, "error": str(e)})

        response_data = {
            "photos": PhotoSerializer(
                created_photos, many=True, context={"request": request}
            ).data,
        }
        if errors:
            response_data["errors"] = errors

        http_status = status.HTTP_202_ACCEPTED if created_photos else status.HTTP_400_BAD_REQUEST
        return Response(response_data, status=http_status)


def _process_single_upload(file, gallery: Gallery, uploader) -> Photo:
    """
    Validate, save and enqueue a single uploaded photo.
    All DB + storage ops in one atomic block.
    """
    from apps.core.exceptions import FileTooLargeException, InvalidMimeTypeException
    import magic

    # Size validation
    if file.size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise FileTooLargeException(f"{file.name} exceeds {settings.MAX_UPLOAD_SIZE_MB}MB.")

    # MIME type validation via python-magic (not just Content-Type header)
    header = file.read(2048)
    file.seek(0)
    detected_mime = magic.from_buffer(header, mime=True)
    if detected_mime not in settings.ACCEPTED_IMAGE_TYPES:
        raise InvalidMimeTypeException(f"Unsupported type for {file.name}: {detected_mime}")

    from apps.photos.services.storage import _generate_photo_path
    from apps.photos.services.watermark import apply_watermark, generate_thumbnail, extract_image_dimensions

    raw_bytes = file.read()
    file.seek(0)

    # Extract dimensions immediately from the uploaded bytes — cheap PIL header read.
    # This guarantees width/height are always populated regardless of Celery availability.
    try:
        width, height = extract_image_dimensions(raw_bytes)
    except Exception as dim_err:
        logger.warning("Could not extract dimensions for %s: %s", file.name, dim_err)
        width, height = None, None

    with transaction.atomic():
        # Determine storage path
        original_path = _generate_photo_path(str(gallery.id), file.name, "original")

        # Persist original to storage
        storage = get_storage_service()
        storage.upload(raw_bytes, original_path, detected_mime)

        # Create DB record with dimensions already populated
        photo = Photo.objects.create(
            gallery=gallery,
            uploaded_by=uploader,
            filename=file.name,
            mime_type=detected_mime,
            size=file.size,
            original_file=original_path,
            width=width,
            height=height,
            status=PhotoStatus.PENDING,
        )

    # Dispatch async processing pipeline OUTSIDE the atomic block so that a
    # broker connection error (e.g. Redis unreachable) does NOT roll back the
    # DB record or the already-completed storage upload.
    try:
        task = process_watermark.apply_async(
            args=[str(photo.id)],
            queue="watermark",
        )
        photo.celery_task_id = task.id
        photo.save(update_fields=["celery_task_id"])
        logger.info(
            "Photo uploaded: %s → gallery %s (task %s)",
            photo.id, gallery.id, task.id,
        )
    except Exception as celery_err:
        logger.warning(
            "Celery unavailable for photo %s (%s) — processing synchronously as fallback.",
            photo.id, celery_err,
        )
        # Synchronous fallback: apply watermark + generate thumbnail inline so the
        # photo is immediately viewable even without a running Celery worker.
        try:
            watermarked_bytes = apply_watermark(raw_bytes)
            thumbnail_bytes = generate_thumbnail(watermarked_bytes)

            gallery_id_str = str(gallery.id)
            wm_path = _generate_photo_path(gallery_id_str, file.name, "watermarked")
            th_path = _generate_photo_path(gallery_id_str, file.name, "thumbnail")

            storage.upload(watermarked_bytes, wm_path, "image/jpeg")
            storage.upload(thumbnail_bytes, th_path, "image/jpeg")

            Photo.objects.filter(id=photo.id).update(
                watermarked_file=wm_path,
                thumbnail_file=th_path,
                width=width,
                height=height,
                status=PhotoStatus.READY,
            )
            photo.refresh_from_db()
            logger.info("Synchronous processing complete for photo %s", photo.id)
        except Exception as sync_err:
            logger.error(
                "Synchronous fallback also failed for photo %s: %s. "
                "Photo saved in PENDING state.",
                photo.id, sync_err,
            )

    return photo


# ─── Secure Download View ─────────────────────────────────────────────────────


class SecureDownloadView(APIView):
    """
    GET /api/photos/download/:token/
    Validates the signed token and serves the original file URL.
    Public endpoint — auth is the token itself.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Photos"],
        summary="Download seguro via token assinado",
        parameters=[
            OpenApiParameter("token", str, OpenApiParameter.PATH, description="Signed download token"),
        ],
    )
    def get(self, request, token: str):
        payload = verify_download_token(token)
        if not payload:
            return Response(
                {"error": {"code": "invalid_token", "message": "Token inválido ou expirado."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        photo_id = payload.get("photo_id")
        try:
            photo = Photo.objects.select_related("gallery").get(id=photo_id)
        except Photo.DoesNotExist:
            raise ResourceNotFoundException("Photo not found.")

        if photo.status != PhotoStatus.READY:
            raise BusinessException("Photo is not ready.")

        # Resolve the actual file URL
        urls = get_photo_urls(photo)

        if settings.USE_S3:
            # For S3: redirect to presigned URL with public hostname so the
            # browser can resolve it (minio:9000 is only reachable inside Docker).
            from django.http import HttpResponseRedirect
            storage = get_storage_service()
            public_url = storage.get_public_presigned_url(
                photo.original_file,
                expires_in=300,  # 5 min — enough for the download to start
            )
            return HttpResponseRedirect(public_url)
        else:
            # For local: return URL to serve via Django
            return Response({
                "url": request.build_absolute_uri(urls["original_url"]),
                "filename": photo.filename,
            })


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _log_download_event(photo: Photo, request) -> None:
    """Write download event to MongoDB audit log (non-blocking, best-effort)."""
    try:
        from datetime import datetime
        col = get_audit_log_collection()
        col.insert_one({
            "event": "photo.download",
            "user_id": str(request.user.id),
            "resource_id": str(photo.id),
            "resource_type": "photo",
            "gallery_id": str(photo.gallery_id),
            "ip_address": _get_client_ip(request),
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:200],
            "metadata": {
                "filename": photo.filename,
                "is_purchased": photo.is_purchased,
            },
            "created_at": datetime.utcnow(),
        })
    except Exception as e:
        logger.warning("Audit log write failed: %s", e)


def _get_client_ip(request) -> str:
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")

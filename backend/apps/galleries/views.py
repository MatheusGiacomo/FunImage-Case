"""
apps/galleries/views.py
Gallery CRUD — scoped by user role.
"""

import logging
from pathlib import Path
from django.conf import settings
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.core.permissions import IsGalleryOwnerOrAdmin
from apps.core.exceptions import ResourceNotFoundException
from .models import Gallery
from .serializers import (
    GallerySerializer,
    GalleryListSerializer,
    GalleryCreateSerializer,
)

logger = logging.getLogger(__name__)

@extend_schema_view(
    list=extend_schema(tags=["Galleries"], summary="Listar galerias"),
    create=extend_schema(tags=["Galleries"], summary="Criar galeria"),
    retrieve=extend_schema(tags=["Galleries"], summary="Obter galeria"),
    update=extend_schema(tags=["Galleries"], summary="Atualizar galeria"),
    destroy=extend_schema(tags=["Galleries"], summary="Deletar galeria"),
)
class GalleryViewSet(ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "client__name"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Gallery.objects.select_related("client", "created_by").prefetch_related("photos")
        user = self.request.user
        if user.is_admin:
            return qs
        return qs.filter(client=user)

    def get_serializer_class(self):
        if self.action == "list":
            return GalleryListSerializer
        if self.action in ("create", "update", "partial_update"):
            return GalleryCreateSerializer
        return GallerySerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        if self.action in ("update", "partial_update", "destroy"):
            return [IsGalleryOwnerOrAdmin()]
        if self.action == "shared":
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        gallery = serializer.save(created_by=self.request.user)
        if self.request.user.is_admin and gallery.client != self.request.user:
            try:
                from apps.notifications.utils import notify
                from apps.notifications.models import NotificationType
                notify(
                    recipient=gallery.client,
                    notification_type=NotificationType.ALBUM_CREATED,
                    title="Novo álbum criado para você",
                    message=f'O álbum "{gallery.name}" foi criado e já está disponível.',
                    data={"gallery_id": str(gallery.id), "gallery_name": gallery.name},
                )
            except Exception as notif_err:
                logger.warning("Could not send album_created notification: %s", notif_err)

    def perform_destroy(self, instance):
        instance.delete()
        logger.info("Gallery soft-deleted: %s by %s", instance.id, self.request.user.id)

    @action(detail=True, methods=["post"], url_path="share", permission_classes=[IsGalleryOwnerOrAdmin])
    def share(self, request, pk=None):
        gallery = self.get_object()
        if not gallery.is_public:
            gallery.is_public = True
            gallery.save(update_fields=["is_public", "updated_at"])

        # Aponta para o frontend em vez da API
        share_url = f"{settings.FRONTEND_URL}/gallery/shared/{gallery.share_token}/"
        return Response({
            "share_url": share_url,
            "share_token": gallery.share_token,
            "expires_at": None,
        })

    @action(detail=True, methods=["post"], url_path="revoke-share", permission_classes=[IsGalleryOwnerOrAdmin])
    def revoke_share(self, request, pk=None):
        gallery = self.get_object()
        gallery.is_public = False
        gallery.rotate_share_token()
        return Response({"message": "Compartilhamento revogado."})

    @action(detail=False, methods=["get"], url_path="shared/(?P<token>[^/.]+)", permission_classes=[AllowAny])
    def shared(self, request, token=None):
        try:
            gallery = Gallery.objects.select_related("client").get(share_token=token, is_public=True)
        except Gallery.DoesNotExist:
            raise ResourceNotFoundException("Galeria não encontrada ou não está pública.")
        return Response(GallerySerializer(gallery, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="download")
    def download_album(self, request, pk=None):
        """Download all purchased photos from a gallery as a ZIP file."""
        import io
        import zipfile
        from django.http import HttpResponse
        from apps.photos.models import Photo, PhotoStatus
        from apps.photos.services.storage import get_storage_service

        gallery = self.get_object()

        photos = list(Photo.objects.filter(
            gallery=gallery,
            deleted_at__isnull=True,
            status=PhotoStatus.READY,
            is_purchased=True,
        ).order_by("sort_order", "created_at"))

        if not photos:
            from apps.core.exceptions import BusinessException
            raise BusinessException(
                "Nenhuma foto adquirida nesta galeria. Adquira o álbum antes de fazer o download."
            )

        storage = get_storage_service()

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for photo in photos:
                try:
                    if settings.USE_S3 and photo.original_file:
                        file_bytes = storage.download_bytes(photo.original_file)
                    elif not settings.USE_S3 and photo.original_file:
                        file_path = Path(settings.MEDIA_ROOT) / photo.original_file
                        file_bytes = file_path.read_bytes()
                    else:
                        continue
                    zf.writestr(photo.filename, file_bytes)
                    logger.debug("ZIP: added %s (%d bytes)", photo.filename, len(file_bytes))
                except Exception as e:
                    logger.warning("ZIP: skipping photo %s: %s", photo.id, e)

        buf.seek(0)
        zip_bytes = buf.read()

        safe_name = "".join(
            c if c.isalnum() or c in "._- " else "_"
            for c in gallery.name
        ).strip() or "album"

        if not request.user.is_admin:
            try:
                from apps.notifications.utils import notify_all_admins
                from apps.notifications.models import NotificationType
                notify_all_admins(
                    notification_type=NotificationType.ALBUM_DOWNLOADED,
                    title="Álbum baixado por cliente",
                    message=f'{request.user.name} baixou o álbum "{gallery.name}" ({len(photos)} foto{"s" if len(photos) > 1 else ""}).',
                    data={
                        "gallery_id":   str(gallery.id),
                        "gallery_name": gallery.name,
                        "client_name":  request.user.name,
                        "photo_count":  len(photos),
                    },
                )
            except Exception as notif_err:
                logger.warning("Could not send album_downloaded notification: %s", notif_err)

        response = HttpResponse(zip_bytes, content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{safe_name}.zip"'
        response["Content-Length"] = len(zip_bytes)
        logger.info(
            "Album ZIP download: gallery %s (%d photos, %d bytes) by %s",
            gallery.id, len(photos), len(zip_bytes), request.user.id,
        )
        return response

    @action(detail=True, methods=["post"], url_path="purchase")
    def purchase(self, request, pk=None):
        """Unlock all photos in a gallery for download using the access code."""
        from apps.core.exceptions import BusinessException
        from apps.photos.models import Photo

        gallery = self.get_object()
        code = request.data.get("code", "").strip()
        expected = getattr(settings, "PURCHASE_ACCESS_CODE", "121212")
        if code != expected:
            raise BusinessException("Código de acesso inválido.")

        updated = Photo.objects.filter(
            gallery=gallery, deleted_at__isnull=True, is_purchased=False
        ).update(is_purchased=True)
        logger.info(
            "Gallery purchased: %s by %s (%d photos unlocked)",
            gallery.id, request.user.id, updated,
        )
        return Response({"unlocked": updated, "gallery_id": str(gallery.id)})

# A CLASSE GalleryPhotoViewSet FOI MOVIDA PARA nested_views.py

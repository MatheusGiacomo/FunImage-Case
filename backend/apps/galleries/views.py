"""
apps/galleries/views.py
Gallery CRUD — scoped by user role.
"""

import logging
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

# REMOVIDO: from apps.photos.views import PhotoViewSet (Causava o erro circular)

from apps.core.permissions import IsAdmin, IsGalleryOwnerOrAdmin
from apps.core.exceptions import ResourceNotFoundException
from .models import Gallery
from .serializers import (
    GallerySerializer,
    GalleryListSerializer,
    GalleryCreateSerializer,
    GalleryShareSerializer,
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

    def perform_destroy(self, instance):
        instance.delete()
        logger.info("Gallery soft-deleted: %s by %s", instance.id, self.request.user.id)

    @action(detail=True, methods=["post"], url_path="share", permission_classes=[IsGalleryOwnerOrAdmin])
    def share(self, request, pk=None):
        gallery = self.get_object()
        if not gallery.is_public:
            gallery.is_public = True
            gallery.save(update_fields=["is_public", "updated_at"])

        share_url = request.build_absolute_uri(f"/api/galleries/shared/{gallery.share_token}/")
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

# A CLASSE GalleryPhotoViewSet FOI MOVIDA PARA nested_views.py
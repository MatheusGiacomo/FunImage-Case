"""
apps/dashboard/views.py
Dashboard stats endpoint — scoped by user role.
"""

import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.galleries.models import Gallery
from apps.photos.models import Photo, PhotoFavorite, PhotoStatus

logger = logging.getLogger(__name__)


class DashboardStatsView(APIView):
    """
    GET /api/dashboard/stats/
    Returns role-scoped stats + recent galleries + recent photos.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        last_30 = now - timedelta(days=30)
        last_7  = now - timedelta(days=7)

        if user.is_admin:
            return self._admin_stats(request, last_7, last_30)
        return self._client_stats(request, last_7, last_30)

    # ── Admin ─────────────────────────────────────────────────────────────────

    def _admin_stats(self, request, last_7, last_30):
        total_photos     = Photo.objects.filter(deleted_at__isnull=True, status=PhotoStatus.READY).count()
        photos_this_week = Photo.objects.filter(deleted_at__isnull=True, created_at__gte=last_7).count()
        total_galleries  = Gallery.objects.filter(deleted_at__isnull=True).count()
        galleries_30d    = Gallery.objects.filter(deleted_at__isnull=True, created_at__gte=last_30).count()
        total_downloads  = Photo.objects.filter(deleted_at__isnull=True, is_purchased=True).count()
        total_favorites  = PhotoFavorite.objects.count()

        stats = [
            {
                "key":   "photos",
                "label": "Total de Fotos",
                "value": total_photos,
                "sub":   f"{photos_this_week} nova{'s' if photos_this_week != 1 else ''} esta semana",
                "icon":  "images",
                "trend": f"+{photos_this_week}" if photos_this_week else None,
            },
            {
                "key":   "galleries",
                "label": "Galerias",
                "value": total_galleries,
                "sub":   f"{galleries_30d} nos últimos 30 dias",
                "icon":  "folder",
                "trend": f"+{galleries_30d}" if galleries_30d else None,
            },
            {
                "key":   "downloads",
                "label": "Downloads Liberados",
                "value": total_downloads,
                "sub":   f"{total_downloads} foto{'s' if total_downloads != 1 else ''} prontas",
                "icon":  "download",
                "trend": None,
            },
            {
                "key":   "favorites",
                "label": "Favoritos",
                "value": total_favorites,
                "sub":   "total acumulado",
                "icon":  "heart",
                "trend": None,
            },
        ]

        recent_galleries = Gallery.objects.filter(
            deleted_at__isnull=True
        ).select_related("client").prefetch_related("photos").order_by("-created_at")[:4]

        from apps.galleries.serializers import GalleryListSerializer
        galleries_data = GalleryListSerializer(
            recent_galleries, many=True, context={"request": request}
        ).data

        return Response({
            "role":             "admin",
            "stats":            stats,
            "recent_galleries": galleries_data,
        })

    # ── Client ────────────────────────────────────────────────────────────────

    def _client_stats(self, request, last_7, last_30):
        user = request.user

        available_photos = Photo.objects.filter(
            gallery__client=user,
            deleted_at__isnull=True,
            status=PhotoStatus.READY,
        ).count()

        total_galleries = Gallery.objects.filter(
            client=user,
            deleted_at__isnull=True,
        ).count()

        total_favorites = PhotoFavorite.objects.filter(user=user).count()

        total_downloads = Photo.objects.filter(
            gallery__client=user,
            deleted_at__isnull=True,
            is_purchased=True,
        ).count()

        stats = [
            {
                "key":   "photos",
                "label": "Fotos disponíveis",
                "value": available_photos,
                "sub":   "prontas para visualizar",
                "icon":  "images",
                "trend": None,
            },
            {
                "key":   "galleries",
                "label": "Álbuns",
                "value": total_galleries,
                "sub":   "criados para você",
                "icon":  "folder",
                "trend": None,
            },
            {
                "key":   "favorites",
                "label": "Favoritos",
                "value": total_favorites,
                "sub":   "fotos curtidas",
                "icon":  "heart",
                "trend": None,
            },
            {
                "key":   "downloads",
                "label": "Downloads",
                "value": total_downloads,
                "sub":   "fotos adquiridas",
                "icon":  "download",
                "trend": None,
            },
        ]

        recent_galleries = Gallery.objects.filter(
            client=user,
            deleted_at__isnull=True,
        ).prefetch_related("photos").order_by("-created_at")[:4]

        from apps.galleries.serializers import GalleryListSerializer
        galleries_data = GalleryListSerializer(
            recent_galleries, many=True, context={"request": request}
        ).data

        recent_photos_qs = Photo.objects.filter(
            gallery__client=user,
            deleted_at__isnull=True,
            status=PhotoStatus.READY,
        ).select_related("gallery").order_by("-created_at")[:6]

        from apps.photos.services.storage import get_photo_urls
        recent_photos = []
        for photo in recent_photos_qs:
            urls = get_photo_urls(photo)
            recent_photos.append({
                "id":            str(photo.id),
                "filename":      photo.filename,
                "gallery_id":    str(photo.gallery_id),
                "thumbnail_url": urls.get("thumbnail_url") or urls.get("watermarked_url"),
                "width":         photo.width,
                "height":        photo.height,
                "created_at":    photo.created_at.isoformat(),
            })

        return Response({
            "role":             "client",
            "stats":            stats,
            "recent_galleries": galleries_data,
            "recent_photos":    recent_photos,
        })

"""
apps/core/views.py
Health check endpoint — verifies connectivity to all backing services.
Returns 200 if healthy, 503 if any critical service is down.
"""

import time
import logging
from django.db import connections
from django.db.utils import OperationalError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def _check_postgres() -> dict:
    start = time.perf_counter()
    try:
        connections["default"].ensure_connection()
        return {"status": "ok", "latency_ms": round((time.perf_counter() - start) * 1000, 1)}
    except OperationalError as e:
        return {"status": "error", "error": str(e)}


def _check_redis() -> dict:
    start = time.perf_counter()
    try:
        from django.core.cache import cache
        cache.set("health_check", "ok", timeout=5)
        val = cache.get("health_check")
        if val != "ok":
            raise ValueError("Cache read/write mismatch")
        return {"status": "ok", "latency_ms": round((time.perf_counter() - start) * 1000, 1)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _check_mongo() -> dict:
    start = time.perf_counter()
    try:
        from apps.core.mongo import ping_mongo
        if not ping_mongo():
            raise ConnectionError("Ping failed")
        return {"status": "ok", "latency_ms": round((time.perf_counter() - start) * 1000, 1)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    GET /api/health/
    Returns service health status. Used by Docker, load balancers, and uptime monitors.
    """
    checks = {
        "postgres": _check_postgres(),
        "redis": _check_redis(),
        "mongo": _check_mongo(),
    }

    all_ok = all(v["status"] == "ok" for v in checks.values())
    http_status = status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE

    return Response(
        {
            "status": "healthy" if all_ok else "degraded",
            "services": checks,
        },
        status=http_status,
    )


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Returns dashboard metrics tailored to the requesting user's role.

    Admin  → system-wide totals (photos, galleries, purchases, favorites, recent activity)
    Client → personal stats (their galleries, photos, favorites, recent photos)
    """
    user = request.user

    if user.is_admin:
        return _admin_stats(request)
    return _client_stats(request)


def _admin_stats(request):
    from apps.photos.models import Photo, PhotoStatus, PhotoFavorite
    from apps.galleries.models import Gallery

    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago  = now - timedelta(days=7)

    total_photos    = Photo.objects.filter(deleted_at__isnull=True).count()
    ready_photos    = Photo.objects.filter(deleted_at__isnull=True, status=PhotoStatus.READY).count()
    total_galleries = Gallery.objects.filter(deleted_at__isnull=True).count()
    total_purchases = Photo.objects.filter(deleted_at__isnull=True, is_purchased=True).count()
    total_favorites = PhotoFavorite.objects.count()

    new_photos_30d    = Photo.objects.filter(deleted_at__isnull=True, created_at__gte=thirty_days_ago).count()
    new_photos_7d     = Photo.objects.filter(deleted_at__isnull=True, created_at__gte=seven_days_ago).count()
    new_galleries_30d = Gallery.objects.filter(deleted_at__isnull=True, created_at__gte=thirty_days_ago).count()

    # Recent galleries (last 5 updated)
    from apps.galleries.serializers import GalleryListSerializer
    recent = Gallery.objects.filter(deleted_at__isnull=True).order_by("-updated_at")[:5]
    recent_data = GalleryListSerializer(recent, many=True, context={"request": request}).data

    return Response({
        "role": "admin",
        "stats": [
            {
                "key":   "total_photos",
                "label": "Total de Fotos",
                "value": total_photos,
                "sub":   f"{new_photos_7d} novos esta semana",
                "icon":  "images",
                "trend": f"+{new_photos_30d}" if new_photos_30d else None,
            },
            {
                "key":   "total_galleries",
                "label": "Galerias",
                "value": total_galleries,
                "sub":   f"{new_galleries_30d} nos últimos 30 dias",
                "icon":  "folder",
                "trend": f"+{new_galleries_30d}" if new_galleries_30d else None,
            },
            {
                "key":   "purchases",
                "label": "Downloads Liberados",
                "value": total_purchases,
                "sub":   f"{ready_photos} fotos prontas",
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
        ],
        "recent_galleries": recent_data,
    })


def _client_stats(request):
    from apps.photos.models import Photo, PhotoStatus, PhotoFavorite
    from apps.galleries.models import Gallery
    from apps.photos.serializers import PhotoListSerializer
    from apps.galleries.serializers import GalleryListSerializer

    user = request.user
    galleries = Gallery.objects.filter(deleted_at__isnull=True, client=user)

    total_galleries = galleries.count()
    total_photos    = Photo.objects.filter(
        deleted_at__isnull=True,
        gallery__in=galleries,
        status=PhotoStatus.READY,
    ).count()
    total_favorites = PhotoFavorite.objects.filter(user=user).count()
    total_purchased = Photo.objects.filter(
        deleted_at__isnull=True,
        gallery__in=galleries,
        is_purchased=True,
    ).count()

    # 6 most recently added ready photos across all client galleries
    from apps.photos.services.storage import get_photo_urls
    recent_photos_qs = Photo.objects.filter(
        deleted_at__isnull=True,
        gallery__in=galleries,
        status=PhotoStatus.READY,
    ).order_by("-created_at")[:6]

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

    # 4 most recently updated galleries
    recent_galleries = GalleryListSerializer(
        galleries.order_by("-updated_at")[:4],
        many=True,
        context={"request": request},
    ).data

    return Response({
        "role": "client",
        "stats": [
            {
                "key":   "total_photos",
                "label": "Fotos disponíveis",
                "value": total_photos,
                "sub":   "prontas para visualizar",
                "icon":  "images",
                "trend": None,
            },
            {
                "key":   "total_galleries",
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
                "key":   "purchased",
                "label": "Downloads",
                "value": total_purchased,
                "sub":   "fotos adquiridas",
                "icon":  "download",
                "trend": None,
            },
        ],
        "recent_photos":    recent_photos,
        "recent_galleries": recent_galleries,
    })


# ─── Global Search ────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def global_search(request):
    """
    GET /api/search/?q=termo
    Busca unificada — retorna galerias e fotos que correspondem ao termo.
    Máximo de 5 resultados por categoria para resposta rápida.
    """
    from django.db.models import Q
    from apps.galleries.models import Gallery
    from apps.photos.models import Photo
    from apps.galleries.serializers import GalleryListSerializer
    from apps.photos.serializers import PhotoListSerializer

    q = request.query_params.get("q", "").strip()
    if not q or len(q) < 2:
        return Response({"galleries": [], "photos": []})

    user = request.user

    # ── Galerias ────────────────────────────────────────────────────────
    gallery_qs = Gallery.objects.select_related("client").filter(
        Q(name__icontains=q) | Q(description__icontains=q) | Q(client__name__icontains=q)
    )
    if not user.is_admin:
        gallery_qs = gallery_qs.filter(client=user)
    galleries = GalleryListSerializer(
        gallery_qs[:5], many=True, context={"request": request}
    ).data

    # ── Fotos ───────────────────────────────────────────────────────────
    photo_qs = Photo.objects.select_related("gallery__client").filter(
        Q(filename__icontains=q) | Q(gallery__name__icontains=q)
    )
    if not user.is_admin:
        photo_qs = photo_qs.filter(gallery__client=user)
    photos = PhotoListSerializer(
        photo_qs[:5], many=True, context={"request": request}
    ).data

    return Response({"galleries": galleries, "photos": photos})

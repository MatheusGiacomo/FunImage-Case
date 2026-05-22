"""
config/urls.py
Root URL configuration — API v1 routing with Swagger docs.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

# ─── API v1 routes ───────────────────────────────────────────────────────────

from apps.core.views import health_check, global_search  # noqa: E402

api_v1_patterns = [
    path("auth/",          include("apps.authentication.urls", namespace="auth")),
    path("users/",         include("apps.users.urls",          namespace="users")),
    path("galleries/",     include("apps.galleries.urls",      namespace="galleries")),
    path("photos/",        include("apps.photos.urls",         namespace="photos")),
    path("notifications/", include("apps.notifications.urls",  namespace="notifications")),
    path("dashboard/",     include("apps.dashboard.urls",      namespace="dashboard")),  # ← novo
    path("health/",        health_check,  name="health"),
    path("search/",        global_search, name="search"),
]

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # API v1
    path("api/", include((api_v1_patterns, "api"), namespace="v1")),

    # OpenAPI schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),

    # Swagger UI
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    # ReDoc
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),

    # Prometheus metrics
    path("", include("django_prometheus.urls")),
]

# ─── Dev extras ──────────────────────────────────────────────────────────────

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    try:
        import debug_toolbar
        urlpatterns = [path("__debug__/", include(debug_toolbar.urls))] + urlpatterns
    except ImportError:
        pass

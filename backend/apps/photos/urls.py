"""
apps/photos/urls.py
Route structure:

  /api/galleries/:gallery_pk/photos/          → gallery-scoped photo list
  /api/photos/upload/                         → multi-file upload
  /api/photos/download/:token/                → signed download
  /api/photos/:pk/                            → photo detail
  /api/photos/:pk/download/                   → generate download token
  /api/photos/:pk/favorite/                   → toggle favorite
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers

from .views import PhotoViewSet, PhotoUploadView, SecureDownloadView

app_name = "photos"

# Standalone photo router
router = DefaultRouter()
router.register("", PhotoViewSet, basename="photo")

urlpatterns = [
    # Standalone
    path("upload/", PhotoUploadView.as_view(), name="upload"),
    path("download/<str:token>/", SecureDownloadView.as_view(), name="secure-download"),
    path("", include(router.urls)),
]

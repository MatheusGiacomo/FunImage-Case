from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GalleryViewSet  # View normal das galerias
from .nested_views import GalleryPhotoViewSet  # A view que herdamos de fotos

app_name = "galleries"

router = DefaultRouter()
router.register("", GalleryViewSet, basename="gallery")

photo_router = DefaultRouter()
photo_router.register(
    r"(?P<gallery_pk>[0-9a-f-]+)/photos",
    GalleryPhotoViewSet,
    basename="gallery-photo",
)

urlpatterns = [
    path("", include(router.urls)),
    path("", include(photo_router.urls)),
]
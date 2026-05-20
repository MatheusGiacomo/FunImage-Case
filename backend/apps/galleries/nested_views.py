# apps/galleries/nested_views.py
from apps.photos.views import PhotoViewSet

class GalleryPhotoViewSet(PhotoViewSet):
    """PhotoViewSet scoped to a parent gallery."""
    def get_queryset(self):
        gallery_pk = self.kwargs.get('gallery_pk')
        return super().get_queryset().filter(gallery_id=gallery_pk)
    
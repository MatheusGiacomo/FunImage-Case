"""
apps/photos/serializers.py
"""

from rest_framework import serializers
from django.conf import settings

from apps.photos.services.storage import get_photo_urls
from apps.photos.services.exif import get_photo_metadata
from .models import Photo, PhotoFavorite, PhotoStatus


class PhotoSerializer(serializers.ModelSerializer):
    """Full photo representation — resolves S3/local URLs dynamically."""

    original_url = serializers.SerializerMethodField()
    watermarked_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    metadata = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = [
            "id", "gallery", "filename", "mime_type", "size",
            "width", "height", "status", "is_purchased",
            "original_url", "watermarked_url", "thumbnail_url",
            "is_favorited", "metadata", "sort_order",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def _get_urls(self, obj) -> dict:
        # Cache URL resolution per instance to avoid 3 separate calls
        cache_attr = "_resolved_urls"
        if not hasattr(obj, cache_attr):
            setattr(obj, cache_attr, get_photo_urls(obj))
        return getattr(obj, cache_attr)

    def get_original_url(self, obj) -> str | None:
        request = self.context.get("request")
        # Only admin and the purchasing client see original (no watermark)
        if request and request.user.is_authenticated:
            if request.user.is_admin or obj.is_purchased:
                return self._get_urls(obj).get("original_url")
        return None

    def get_watermarked_url(self, obj) -> str | None:
        return self._get_urls(obj).get("watermarked_url")

    def get_thumbnail_url(self, obj) -> str | None:
        return self._get_urls(obj).get("thumbnail_url")

    def get_is_favorited(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        # Use prefetch cache if available (set in ViewSet)
        prefetched = getattr(obj, "_user_favorited", None)
        if prefetched is not None:
            return prefetched
        return PhotoFavorite.objects.filter(user=request.user, photo=obj).exists()

    def get_metadata(self, obj) -> dict | None:
        if obj.status != PhotoStatus.READY:
            return None
        return get_photo_metadata(str(obj.id))


class PhotoListSerializer(serializers.ModelSerializer):
    """Lightweight list serializer — no MongoDB call, no URL resolution per item."""

    thumbnail_url = serializers.SerializerMethodField()
    watermarked_url = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    gallery_name = serializers.CharField(source="gallery.name", read_only=True)

    class Meta:
        model = Photo
        fields = [
            "id", "gallery_id", "gallery_name", "filename", "mime_type", "size", "width", "height",
            "status", "is_purchased", "thumbnail_url", "watermarked_url",
            "is_favorited", "sort_order", "created_at",
        ]

    def get_thumbnail_url(self, obj) -> str | None:
        urls = get_photo_urls(obj)
        return urls.get("thumbnail_url") or urls.get("watermarked_url")

    def get_watermarked_url(self, obj) -> str | None:
        return get_photo_urls(obj).get("watermarked_url")

    def get_is_favorited(self, obj) -> bool:
        return getattr(obj, "_user_favorited", False)


class PhotoUploadSerializer(serializers.Serializer):
    """Multipart upload — validates files before task dispatch."""

    photo = serializers.ImageField()
    gallery_id = serializers.UUIDField()

    def validate_photo(self, file):
        from django.conf import settings
        from apps.core.exceptions import FileTooLargeException, InvalidMimeTypeException
        import magic

        if file.size > settings.MAX_UPLOAD_SIZE_BYTES:
            raise FileTooLargeException(
                f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit."
            )

        # Read first 2KB for MIME detection — don't trust the Content-Type header
        header = file.read(2048)
        file.seek(0)
        detected_mime = magic.from_buffer(header, mime=True)

        if detected_mime not in settings.ACCEPTED_IMAGE_TYPES:
            raise InvalidMimeTypeException(
                f"Unsupported file type: {detected_mime}. "
                f"Accepted: {', '.join(settings.ACCEPTED_IMAGE_TYPES)}"
            )

        return file


class BulkUploadSerializer(serializers.Serializer):
    """Validate a batch of photos for gallery upload."""

    photos = serializers.ListField(
        child=serializers.ImageField(),
        max_length=50,
        min_length=1,
    )
    gallery_id = serializers.UUIDField()


class SignedDownloadSerializer(serializers.Serializer):
    """Response envelope for download token generation."""

    url = serializers.CharField()
    token = serializers.CharField()
    filename = serializers.CharField()
    expires_at = serializers.DateTimeField()


class FavoriteToggleSerializer(serializers.Serializer):
    is_favorited = serializers.BooleanField()
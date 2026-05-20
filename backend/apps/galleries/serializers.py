"""
apps/galleries/serializers.py
"""

from rest_framework import serializers
from django.conf import settings

from apps.users.serializers import UserSerializer
from .models import Gallery


class GalleryPhotoPreviewSerializer(serializers.Serializer):
    """Minimal photo representation for gallery cover."""
    id = serializers.UUIDField()
    thumbnail_url = serializers.CharField()
    watermarked_url = serializers.CharField()
    width = serializers.IntegerField()
    height = serializers.IntegerField()


class GallerySerializer(serializers.ModelSerializer):
    """Full gallery representation."""

    client = UserSerializer(read_only=True)
    photo_count = serializers.ReadOnlyField()
    cover_photo = GalleryPhotoPreviewSerializer(read_only=True)
    preview_photos = serializers.SerializerMethodField()
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = Gallery
        fields = [
            "id", "name", "description", "client", "created_by",
            "is_public", "share_url", "cover_photo", "preview_photos", "photo_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "client", "created_by", "share_url", "created_at", "updated_at"]

    def get_preview_photos(self, obj):
        from apps.photos.services.storage import get_photo_urls
        photos = obj.photos.filter(
            deleted_at__isnull=True, status="ready"
        ).order_by("sort_order", "-created_at")[:4]
        result = []
        for photo in photos:
            urls = get_photo_urls(photo)
            result.append({
                "id": str(photo.id),
                "thumbnail_url": urls.get("thumbnail_url") or urls.get("watermarked_url"),
                "watermarked_url": urls.get("watermarked_url"),
                "width": photo.width,
                "height": photo.height,
            })
        return result

    def get_share_url(self, obj) -> str | None:
        if not obj.is_public:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/api/galleries/shared/{obj.share_token}/")
        return f"/api/galleries/shared/{obj.share_token}/"


class GalleryListSerializer(serializers.ModelSerializer):
    """Lightweight list serializer — avoids heavy joins."""

    photo_count = serializers.ReadOnlyField()
    cover_photo = GalleryPhotoPreviewSerializer(read_only=True)
    preview_photos = serializers.SerializerMethodField()
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Gallery
        fields = [
            "id", "name", "description", "client_name",
            "is_public", "photo_count", "cover_photo", "preview_photos",
            "created_at", "updated_at",
        ]

    def get_preview_photos(self, obj):
        from apps.photos.services.storage import get_photo_urls
        photos = obj.photos.filter(
            deleted_at__isnull=True, status="ready"
        ).order_by("sort_order", "-created_at")[:4]
        result = []
        for photo in photos:
            urls = get_photo_urls(photo)
            result.append({
                "id": str(photo.id),
                "thumbnail_url": urls.get("thumbnail_url") or urls.get("watermarked_url"),
                "watermarked_url": urls.get("watermarked_url"),
                "width": photo.width,
                "height": photo.height,
            })
        return result


class GalleryCreateSerializer(serializers.ModelSerializer):
    """Create / update a gallery (admin assigns client)."""

    client_id = serializers.UUIDField(required=False)

    class Meta:
        model = Gallery
        fields = ["name", "description", "is_public", "client_id"]

    def to_representation(self, instance):
        """Return the full GallerySerializer representation after create/update.
        This ensures the response contains id, created_at, photo_count, etc."""
        return GallerySerializer(instance, context=self.context).to_representation(instance)

    def validate(self, attrs):
        request = self.context["request"]
        # If client is not admin, gallery belongs to themselves
        if not request.user.is_admin:
            attrs["client_id"] = request.user.id
        elif "client_id" not in attrs:
            raise serializers.ValidationError({"client_id": "Required for admin users."})
        return attrs

    def create(self, validated_data):
        from apps.users.models import User
        client_id = validated_data.pop("client_id")
        client = User.objects.get(id=client_id)
        return Gallery.objects.create(
            client=client,
            created_by=self.context["request"].user,
            **validated_data,
        )


class GalleryShareSerializer(serializers.Serializer):
    """Response for share endpoint."""
    share_url = serializers.CharField()
    share_token = serializers.CharField()
    expires_at = serializers.DateTimeField(allow_null=True)
    
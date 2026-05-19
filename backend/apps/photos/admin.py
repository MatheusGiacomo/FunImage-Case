from django.contrib import admin
from .models import Photo, PhotoFavorite

@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ["filename", "gallery", "status", "is_purchased", "size", "created_at"]
    list_filter = ["status", "is_purchased", "mime_type"]
    search_fields = ["filename", "gallery__name", "gallery__client__email"]
    raw_id_fields = ["gallery", "uploaded_by"]
    readonly_fields = ["id", "celery_task_id", "created_at", "updated_at"]

@admin.register(PhotoFavorite)
class PhotoFavoriteAdmin(admin.ModelAdmin):
    list_display = ["user", "photo", "created_at"]
    raw_id_fields = ["user", "photo"]

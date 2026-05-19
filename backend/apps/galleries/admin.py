from django.contrib import admin
from .models import Gallery

@admin.register(Gallery)
class GalleryAdmin(admin.ModelAdmin):
    list_display = ["name", "client", "is_public", "photo_count", "created_at"]
    list_filter = ["is_public"]
    search_fields = ["name", "client__email", "client__name"]
    raw_id_fields = ["client", "created_by"]
    readonly_fields = ["id", "share_token", "created_at", "updated_at"]

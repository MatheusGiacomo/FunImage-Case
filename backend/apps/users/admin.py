from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "name", "role", "is_active", "created_at"]
    list_filter = ["role", "is_active", "is_staff"]
    search_fields = ["email", "name"]
    ordering = ["-created_at"]
    readonly_fields = ["id", "created_at", "updated_at", "last_login"]
    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("Info", {"fields": ("name", "phone", "avatar")}),
        ("Permissões", {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        ("Datas", {"fields": ("created_at", "updated_at", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "name", "role", "password1", "password2")}),
    )
    filter_horizontal = []

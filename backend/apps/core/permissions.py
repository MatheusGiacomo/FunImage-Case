"""
apps/core/permissions.py
Reusable DRF permission classes.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    """Only admin users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsClient(BasePermission):
    """Only client users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "client"
        )


class IsAdminOrReadOnly(BasePermission):
    """Admin can write; authenticated users can read."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == "admin"


class IsOwnerOrAdmin(BasePermission):
    """Object-level: owner or admin can access."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == "admin":
            return True
        owner = getattr(obj, "client", None) or getattr(obj, "user", None)
        return owner == request.user


class IsGalleryOwnerOrAdmin(BasePermission):
    """Can access a gallery only if it's theirs or they're admin."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == "admin":
            return True
        # Gallery.client is the owner
        return getattr(obj, "client_id", None) == request.user.id

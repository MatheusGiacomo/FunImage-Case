"""
apps/galleries/models.py
Gallery — belongs to a client, contains photos.
"""

import secrets
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel


class Gallery(BaseModel):
    """
    A named collection of photos assigned to a client.

    - One client can have many galleries.
    - Admins can create/manage galleries for any client.
    - Share tokens allow temporary public access without authentication.
    """

    name = models.CharField(max_length=200, db_index=True)
    description = models.TextField(blank=True)

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,  # Never lose a gallery if user is deactivated
        related_name="galleries",
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_galleries",
    )

    is_public = models.BooleanField(default=False, db_index=True)
    share_token = models.CharField(max_length=64, unique=True, blank=True, db_index=True)

    class Meta(BaseModel.Meta):
        db_table = "galleries"
        verbose_name = "Galeria"
        verbose_name_plural = "Galerias"
        indexes = [
            models.Index(fields=["client", "deleted_at"]),
            models.Index(fields=["share_token"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.client.name})"

    def save(self, *args, **kwargs):
        if not self.share_token:
            self.share_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def rotate_share_token(self) -> str:
        """Generate a new share token, invalidating the old one."""
        self.share_token = secrets.token_urlsafe(32)
        self.save(update_fields=["share_token", "updated_at"])
        return self.share_token

    @property
    def photo_count(self) -> int:
        return self.photos.filter(deleted_at__isnull=True).count()

    @property
    def cover_photo(self):
        return self.photos.filter(deleted_at__isnull=True, status="ready").first()

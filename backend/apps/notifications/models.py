"""
apps/notifications/models.py
In-app notification model.

Each notification targets one recipient (User).
Admins receive notifications about client activity (downloads).
Clients receive notifications about admin activity (uploads, gallery creation, photo ready).
"""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class NotificationType(models.TextChoices):
    # Client ← Admin
    PHOTO_UPLOADED  = "photo_uploaded",  "Fotos carregadas"
    PHOTO_READY     = "photo_ready",     "Fotos processadas"
    ALBUM_CREATED   = "album_created",   "Álbum criado"
    # Admin ← Client
    PHOTO_DOWNLOADED = "photo_downloaded", "Foto baixada por cliente"
    ALBUM_DOWNLOADED = "album_downloaded", "Álbum baixado por cliente"


class Notification(BaseModel):
    """
    A single in-app notification for one user.

    `data` holds a free-form JSON payload with context-specific IDs
    so the frontend can build deep links (gallery_id, photo_id, etc.).
    """

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        db_index=True,
    )
    title   = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    # Extra context (gallery_id, photo_id, photo_count, actor_name, …)
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"[{self.type}] → {self.recipient_id} — {self.title}"

    def mark_read(self):
        from django.utils import timezone
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at", "updated_at"])
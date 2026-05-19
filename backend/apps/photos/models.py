"""
apps/photos/models.py
Photo — the core entity of the platform.

Storage strategy:
  - PostgreSQL: structured metadata, status, ownership
  - S3/local FS: actual image files (original + watermarked + thumbnail)
  - MongoDB: EXIF metadata, processing audit trail (see apps.core.mongo)
"""

from django.db import models
from django.conf import settings
from apps.core.models import BaseModel
from apps.galleries.models import Gallery


class PhotoStatus(models.TextChoices):
    PENDING = "pending", "Aguardando processamento"
    PROCESSING = "processing", "Processando"
    READY = "ready", "Pronto"
    ERROR = "error", "Erro"


class Photo(BaseModel):
    """
    Represents a single photograph in the platform.

    Upload flow:
      1. Client POSTs to /api/photos/upload/ (multipart)
      2. Record created with status=PENDING
      3. Original file saved to storage
      4. Celery task: process_watermark → generate_thumbnail → upload_to_s3
      5. Status updated to READY on success, ERROR on failure
    """

    gallery = models.ForeignKey(
        Gallery,
        on_delete=models.CASCADE,
        related_name="photos",
        db_index=True,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_photos",
    )

    # ── File paths (relative to MEDIA_ROOT or S3 bucket) ──────────────────
    original_file = models.CharField(max_length=500)
    watermarked_file = models.CharField(max_length=500, blank=True)
    thumbnail_file = models.CharField(max_length=500, blank=True)

    # ── Image metadata ─────────────────────────────────────────────────────
    filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=50)
    size = models.PositiveIntegerField(help_text="File size in bytes")
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    # ── Processing state ───────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=PhotoStatus.choices,
        default=PhotoStatus.PENDING,
        db_index=True,
    )
    processing_error = models.TextField(blank=True)
    celery_task_id = models.CharField(max_length=255, blank=True, db_index=True)

    # ── Business logic ─────────────────────────────────────────────────────
    is_purchased = models.BooleanField(default=False, db_index=True)
    sort_order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta(BaseModel.Meta):
        db_table = "photos"
        verbose_name = "Foto"
        verbose_name_plural = "Fotos"
        ordering = ["sort_order", "-created_at"]
        indexes = [
            models.Index(fields=["gallery", "status", "deleted_at"]),
            models.Index(fields=["gallery", "sort_order"]),
            models.Index(fields=["status", "celery_task_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.filename} [{self.status}]"

    @property
    def is_ready(self) -> bool:
        return self.status == PhotoStatus.READY

    @property
    def original_url(self) -> str | None:
        if not self.original_file:
            return None
        if settings.USE_S3:
            # S3 URLs are generated via boto3 presigned URLs (see service layer)
            return None
        return f"{settings.MEDIA_URL}{self.original_file}"

    @property
    def watermarked_url(self) -> str | None:
        if not self.watermarked_file:
            return self.original_url
        if settings.USE_S3:
            return None
        return f"{settings.MEDIA_URL}{self.watermarked_file}"

    @property
    def thumbnail_url(self) -> str | None:
        if not self.thumbnail_file:
            return self.watermarked_url
        if settings.USE_S3:
            return None
        return f"{settings.MEDIA_URL}{self.thumbnail_file}"


class PhotoFavorite(models.Model):
    """Many-to-many through model for user photo favorites."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorited_photos",
    )
    photo = models.ForeignKey(
        Photo,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "photo_favorites"
        unique_together = [("user", "photo")]
        indexes = [models.Index(fields=["user", "photo"])]

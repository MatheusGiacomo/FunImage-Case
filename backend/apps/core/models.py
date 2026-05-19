"""
apps/core/models.py
Abstract base models shared across the entire application.
"""

import uuid
from django.db import models
from django.utils import timezone


class UUIDModel(models.Model):
    """Primary key as UUID4 — prevents enumeration attacks."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Automatic created_at / updated_at timestamps."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class SoftDeleteQuerySet(models.QuerySet):
    """QuerySet that filters out soft-deleted records by default."""

    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)

    def delete(self):
        """Soft-delete all records in this queryset."""
        return self.update(deleted_at=timezone.now())

    def hard_delete(self):
        """Permanently delete records from the database."""
        return super().delete()


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()

    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    def only_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db).dead()


class SoftDeleteModel(models.Model):
    """Soft deletion support — records are marked deleted, never removed."""

    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at"])

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.deleted_at = None
        self.save(update_fields=["deleted_at"])

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel, SoftDeleteModel):
    """Full-featured base model: UUID PK + timestamps + soft delete."""

    class Meta(UUIDModel.Meta):
        abstract = True
        ordering = ["-created_at"]

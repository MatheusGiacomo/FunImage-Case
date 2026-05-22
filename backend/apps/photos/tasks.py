"""
apps/photos/tasks.py
Celery task pipeline for photo processing.

Pipeline (chained):
  upload received → save original → process_watermark → generate_thumbnail
                  → extract_exif → [upload_to_s3 if S3 enabled]
                  → mark READY

Each task is idempotent and retries on transient failures.
"""

import logging
from datetime import datetime

from celery import shared_task
from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 5},
    queue="watermark",
    name="apps.photos.tasks.process_watermark",
)
def process_watermark(self, photo_id: str) -> str:
    """
    Task 1: Apply watermark + generate thumbnail.
    Reads the original file, applies watermark, writes watermarked + thumbnail back.
    """
    from apps.photos.models import Photo, PhotoStatus
    from apps.photos.services.watermark import apply_watermark, generate_thumbnail, extract_image_dimensions
    from apps.photos.services.storage import get_storage_service, _generate_photo_path

    logger.info("Processing watermark for photo %s (attempt %d)", photo_id, self.request.retries + 1)

    try:
        photo = Photo.objects.select_related("gallery").get(id=photo_id)
    except Photo.DoesNotExist:
        logger.error("Photo not found: %s", photo_id)
        return photo_id

    if photo.status not in (PhotoStatus.PENDING, PhotoStatus.ERROR):
        logger.info("Photo %s already processed (status=%s), skipping", photo_id, photo.status)
        return photo_id

    # Mark as processing
    Photo.objects.filter(id=photo_id).update(
        status=PhotoStatus.PROCESSING,
        celery_task_id=self.request.id,
    )

    try:
        storage = get_storage_service()

        # Read original bytes
        if settings.USE_S3:
            from apps.photos.services.storage import S3StorageService
            s3 = S3StorageService()
            response = s3._client.get_object(Bucket=s3._bucket, Key=photo.original_file)
            original_bytes = response["Body"].read()
        else:
            original_bytes = (settings.MEDIA_ROOT / photo.original_file).read_bytes()

        # Watermark
        watermarked_bytes = apply_watermark(original_bytes)

        # Thumbnail (from watermarked — always shows watermark in preview)
        thumbnail_bytes = generate_thumbnail(watermarked_bytes)

        # Dimensions (from original for accurate metadata)
        width, height = extract_image_dimensions(original_bytes)

        # Save variants
        gallery_id = str(photo.gallery_id)
        wm_path = _generate_photo_path(gallery_id, photo.filename, "watermarked")
        th_path = _generate_photo_path(gallery_id, photo.filename, "thumbnail")

        storage.upload(watermarked_bytes, wm_path, "image/jpeg")
        storage.upload(thumbnail_bytes, th_path, "image/jpeg")

        # Update photo record
        with transaction.atomic():
            Photo.objects.filter(id=photo_id).update(
                watermarked_file=wm_path,
                thumbnail_file=th_path,
                width=width,
                height=height,
                processing_error="",
            )

        logger.info("Watermark applied for photo %s", photo_id)

        # Chain to EXIF extraction
        extract_exif_metadata.apply_async(args=[photo_id], queue="watermark")

        return photo_id

    except Exception as exc:
        logger.exception("Watermark processing failed for photo %s: %s", photo_id, exc)

        if self.request.retries >= self.max_retries:
            Photo.objects.filter(id=photo_id).update(
                status=PhotoStatus.ERROR,
                processing_error=str(exc),
            )

        raise


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 2, "countdown": 3},
    queue="watermark",
    name="apps.photos.tasks.extract_exif_metadata",
)
def extract_exif_metadata(self, photo_id: str) -> str:
    """
    Task 2: Extract EXIF and persist to MongoDB.
    Runs after watermark is applied.
    """
    from apps.photos.models import Photo, PhotoStatus
    from apps.photos.services.exif import extract_exif, save_photo_metadata

    logger.info("Extracting EXIF for photo %s", photo_id)

    try:
        photo = Photo.objects.get(id=photo_id)
    except Photo.DoesNotExist:
        return photo_id

    try:
        if settings.USE_S3:
            from apps.photos.services.storage import S3StorageService
            s3 = S3StorageService()
            response = s3._client.get_object(Bucket=s3._bucket, Key=photo.original_file)
            original_bytes = response["Body"].read()
        else:
            original_bytes = (settings.MEDIA_ROOT / photo.original_file).read_bytes()

        exif = extract_exif(original_bytes)

        processing_info = {
            "original_filename": photo.filename,
            "original_size_bytes": photo.size,
            "watermark_applied_at": datetime.utcnow(),
            "mime_type": photo.mime_type,
        }

        save_photo_metadata(str(photo.id), exif, processing_info)
        logger.info("EXIF saved for photo %s (%d tags)", photo_id, len(exif))

    except Exception as exc:
        logger.warning("EXIF extraction failed for photo %s (non-fatal): %s", photo_id, exc)
        # Non-fatal — don't fail the photo over missing EXIF

    # Mark photo as READY regardless of EXIF outcome
    Photo.objects.filter(id=photo_id).update(status=PhotoStatus.READY)
    logger.info("Photo %s is now READY", photo_id)

    # Notify gallery client that their photo is ready to view
    try:
        photo_refreshed = Photo.objects.select_related("gallery__client").get(id=photo_id)
        client = photo_refreshed.gallery.client
        if client:
            from apps.notifications.utils import notify
            from apps.notifications.models import NotificationType
            notify(
                recipient=client,
                notification_type=NotificationType.PHOTO_READY,
                title="Sua foto está pronta",
                message=f'"{photo_refreshed.filename}" foi processada e já está disponível em "{photo_refreshed.gallery.name}".',
                data={
                    "photo_id":     photo_id,
                    "gallery_id":   str(photo_refreshed.gallery_id),
                    "gallery_name": photo_refreshed.gallery.name,
                    "filename":     photo_refreshed.filename,
                },
            )
    except Exception as notif_err:
        logger.warning("Could not send photo_ready notification for %s: %s", photo_id, notif_err)

    return photo_id


@shared_task(
    bind=True,
    queue="maintenance",
    name="apps.photos.tasks.cleanup_temp_files",
)
def cleanup_temp_files(self) -> dict:
    """
    Periodic task: clean up orphaned temp files and ERROR-state photos older than 24h.
    Scheduled via django-celery-beat.
    """
    from apps.photos.models import Photo, PhotoStatus
    from django.utils import timezone
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(hours=24)
    error_photos = Photo.objects.filter(
        status=PhotoStatus.ERROR,
        created_at__lt=cutoff,
    )
    count = error_photos.count()
    error_photos.delete()  # Soft delete

    logger.info("Cleaned up %d stale error photos", count)
    return {"deleted": count}


@shared_task(
    bind=True,
    queue="maintenance",
    name="apps.photos.tasks.reprocess_failed_photos",
)
def reprocess_failed_photos(self) -> dict:
    """
    Periodic task: retry photos stuck in PROCESSING or ERROR state.
    Handles cases where workers crashed mid-task.
    """
    from apps.photos.models import Photo, PhotoStatus
    from django.utils import timezone
    from datetime import timedelta

    # Photos stuck in processing for more than 15 minutes
    stuck_cutoff = timezone.now() - timedelta(minutes=15)
    stuck_photos = Photo.objects.filter(
        status=PhotoStatus.PROCESSING,
        updated_at__lt=stuck_cutoff,
    )

    requeued = 0
    for photo in stuck_photos:
        photo.status = PhotoStatus.PENDING
        photo.save(update_fields=["status", "updated_at"])
        process_watermark.apply_async(args=[str(photo.id)], queue="watermark")
        requeued += 1

    logger.info("Requeued %d stuck photos", requeued)
    return {"requeued": requeued}

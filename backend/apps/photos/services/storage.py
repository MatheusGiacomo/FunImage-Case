"""
apps/photos/services/storage.py
Storage service — abstracts S3 and local filesystem behind a uniform interface.

All methods return public URLs or paths suitable for client consumption.
Signed URL generation is handled here for secure download access.
"""

import io
import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.exceptions import ClientError
from django.conf import settings
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

logger = logging.getLogger(__name__)

# ─── Path helpers ─────────────────────────────────────────────────────────────


def _generate_photo_path(gallery_id: str, filename: str, variant: str = "original") -> str:
    """
    photos/{gallery_id}/{variant}/{uuid}_{filename}
    variant: original | watermarked | thumbnail
    """
    ext = Path(filename).suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    return f"photos/{gallery_id}/{variant}/{unique_name}"


# ─── S3 Storage ───────────────────────────────────────────────────────────────


class S3StorageService:
    """Handles all S3 / MinIO operations."""

    def __init__(self):
        kwargs = dict(
            region_name=settings.AWS_S3_REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        if endpoint := getattr(settings, "AWS_S3_ENDPOINT_URL", None):
            kwargs["endpoint_url"] = endpoint

        self._client = boto3.client("s3", **kwargs)
        self._bucket = settings.AWS_STORAGE_BUCKET_NAME

    def upload(self, file_bytes: bytes, path: str, content_type: str = "image/jpeg") -> str:
        """Upload bytes to S3. Returns the S3 key."""
        self._client.put_object(
            Bucket=self._bucket,
            Key=path,
            Body=file_bytes,
            ContentType=content_type,
            # ServerSideEncryption="AES256",
            # Private by default — no public-read ACL
        )
        logger.debug("S3 upload: s3://%s/%s (%d bytes)", self._bucket, path, len(file_bytes))
        return path

    def get_presigned_url(self, key: str, expires_in: int = None) -> str:
        """Generate a pre-signed GET URL valid for `expires_in` seconds.

        Returns the internal endpoint URL (e.g. http://minio:9000) so that
        the Next.js image optimizer (running inside Docker) can fetch and
        proxy the image to the browser. For direct browser downloads use
        get_public_presigned_url() instead.
        """
        expires_in = expires_in or settings.AWS_QUERYSTRING_EXPIRE
        url = self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url

    def get_public_presigned_url(self, key: str, expires_in: int = None) -> str:
        """Like get_presigned_url but rewrites the hostname to MINIO_PUBLIC_URL.

        Use this when the URL will be consumed directly by the browser (e.g.
        download redirects), NOT when it will be proxied by Next.js optimizer.
        """
        url = self.get_presigned_url(key, expires_in)
        internal = getattr(settings, "AWS_S3_ENDPOINT_URL", "")
        public = getattr(settings, "MINIO_PUBLIC_URL", "")
        if internal and public and internal != public:
            url = url.replace(internal, public, 1)
        return url

    def download_bytes(self, key: str) -> bytes:
        """Fetch the raw bytes of an object from S3."""
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except ClientError as e:
            logger.error("S3 delete failed for key %s: %s", key, e)

    def exists(self, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False


# ─── Local Storage ────────────────────────────────────────────────────────────


class LocalStorageService:
    """Local filesystem storage for development."""

    def upload(self, file_bytes: bytes, path: str, content_type: str = "image/jpeg") -> str:
        full_path = settings.MEDIA_ROOT / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(file_bytes)
        logger.debug("Local storage write: %s (%d bytes)", path, len(file_bytes))
        return path

    def get_public_url(self, path: str) -> str:
        return f"{settings.MEDIA_URL}{path}"

    def delete(self, path: str) -> None:
        full_path = settings.MEDIA_ROOT / path
        if full_path.exists():
            full_path.unlink()

    def exists(self, path: str) -> bool:
        return (settings.MEDIA_ROOT / path).exists()

    def read(self, path: str) -> bytes:
        return (settings.MEDIA_ROOT / path).read_bytes()


# ─── Factory ─────────────────────────────────────────────────────────────────


def get_storage_service():
    if settings.USE_S3:
        return S3StorageService()
    return LocalStorageService()


# ─── Download Token (itsdangerous) ───────────────────────────────────────────


def _get_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        settings.DOWNLOAD_TOKEN_SECRET,
        salt="photo-download",
    )


def generate_download_token(photo_id: str, user_id: str) -> dict:
    """
    Generate a signed download token.
    Payload is signed with itsdangerous — tamper-proof, time-limited.
    """
    s = _get_serializer()
    payload = {"photo_id": photo_id, "user_id": user_id}
    token = s.dumps(payload)
    expires_at = datetime.utcnow() + timedelta(seconds=settings.DOWNLOAD_TOKEN_MAX_AGE)

    return {
        "token": token,
        "expires_at": expires_at.isoformat() + "Z",
        "max_age": settings.DOWNLOAD_TOKEN_MAX_AGE,
    }


def verify_download_token(token: str) -> dict | None:
    """
    Verify and decode a download token.
    Returns the payload dict or None if invalid/expired.
    """
    s = _get_serializer()
    try:
        payload = s.loads(token, max_age=settings.DOWNLOAD_TOKEN_MAX_AGE)
        return payload
    except SignatureExpired:
        logger.warning("Download token expired")
        return None
    except BadSignature:
        logger.warning("Download token invalid signature")
        return None


# ─── Photo Upload Pipeline ────────────────────────────────────────────────────


def save_upload(
    file_bytes: bytes,
    gallery_id: str,
    filename: str,
    mime_type: str,
) -> tuple[str, str, str]:
    """
    Persist all three variants of a photo.
    Returns (original_path, watermarked_path, thumbnail_path).
    This is called from the Celery task after processing.
    """
    from apps.photos.services.watermark import apply_watermark, generate_thumbnail

    storage = get_storage_service()

    original_path = _generate_photo_path(gallery_id, filename, "original")
    watermarked_path = _generate_photo_path(gallery_id, filename, "watermarked")
    thumbnail_path = _generate_photo_path(gallery_id, filename, "thumbnail")

    # Original
    storage.upload(file_bytes, original_path, mime_type)

    # Watermarked version
    watermarked_bytes = apply_watermark(file_bytes)
    storage.upload(watermarked_bytes, watermarked_path, "image/jpeg")

    # Thumbnail (from watermarked — client always sees watermark)
    thumbnail_bytes = generate_thumbnail(watermarked_bytes)
    storage.upload(thumbnail_bytes, thumbnail_path, "image/jpeg")

    return original_path, watermarked_path, thumbnail_path


def get_photo_urls(photo) -> dict[str, str | None]:
    """
    Resolve public URLs for all photo variants.
    For S3: generates presigned URLs. For local: returns MEDIA_URL paths.
    """
    if settings.USE_S3:
        service = S3StorageService()
        return {
            "original_url": service.get_presigned_url(photo.original_file) if photo.original_file else None,
            "watermarked_url": service.get_presigned_url(photo.watermarked_file) if photo.watermarked_file else None,
            "thumbnail_url": service.get_presigned_url(photo.thumbnail_file) if photo.thumbnail_file else None,
        }
    else:
        service = LocalStorageService()
        return {
            "original_url": service.get_public_url(photo.original_file) if photo.original_file else None,
            "watermarked_url": service.get_public_url(photo.watermarked_file) if photo.watermarked_file else None,
            "thumbnail_url": service.get_public_url(photo.thumbnail_file) if photo.thumbnail_file else None,
        }
    
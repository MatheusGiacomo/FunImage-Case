"""
apps/photos/tests/test_photos.py
Tests for photo upload, download tokens, favorites, and watermark service.
"""

import io
import pytest
from unittest.mock import patch, MagicMock
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.tests.factories import UserFactory, AdminUserFactory
from apps.photos.tests.factories import GalleryFactory, PhotoFactory
from apps.photos.services.watermark import apply_watermark, generate_thumbnail, extract_image_dimensions
from apps.photos.services.storage import generate_download_token, verify_download_token


# ─── Helpers ─────────────────────────────────────────────────────────────────


def make_jpeg_bytes(width: int = 800, height: int = 600) -> bytes:
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def make_upload_file(name: str = "test.jpg", width=800, height=600):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(name, make_jpeg_bytes(width, height), content_type="image/jpeg")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin(db):
    return AdminUserFactory(password="adminpass")


@pytest.fixture
def client_user(db):
    return UserFactory(password="pass1234")


def auth(api_client, user, password="pass1234"):
    resp = api_client.post("/api/auth/login/", {"email": user.email, "password": password}, format="json")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return api_client


# ─── Watermark Service ────────────────────────────────────────────────────────


class TestWatermarkService:
    def test_apply_watermark_returns_jpeg_bytes(self):
        original = make_jpeg_bytes()
        result = apply_watermark(original)
        assert isinstance(result, bytes)
        assert len(result) > 0
        # Validate it's a valid JPEG
        img = Image.open(io.BytesIO(result))
        assert img.format == "JPEG"

    def test_watermarked_image_preserves_approximate_dimensions(self):
        original = make_jpeg_bytes(1200, 800)
        watermarked = apply_watermark(original)
        img = Image.open(io.BytesIO(watermarked))
        # Dimensions should be the same after watermark
        assert img.size == (1200, 800)

    def test_apply_watermark_custom_text(self):
        original = make_jpeg_bytes()
        result = apply_watermark(original, text="© Estúdio Teste 2026")
        assert isinstance(result, bytes)
        img = Image.open(io.BytesIO(result))
        assert img.format == "JPEG"

    def test_apply_watermark_tiled_position(self):
        original = make_jpeg_bytes()
        result = apply_watermark(original, position="tiled")
        assert isinstance(result, bytes)

    def test_generate_thumbnail_reduces_size(self):
        original = make_jpeg_bytes(3000, 2000)
        thumbnail = generate_thumbnail(original, max_size=(800, 800))
        img = Image.open(io.BytesIO(thumbnail))
        assert img.width <= 800
        assert img.height <= 800

    def test_generate_thumbnail_maintains_aspect_ratio(self):
        # 2:1 ratio image
        original = make_jpeg_bytes(2000, 1000)
        thumbnail = generate_thumbnail(original, max_size=(800, 800))
        img = Image.open(io.BytesIO(thumbnail))
        ratio = img.width / img.height
        assert abs(ratio - 2.0) < 0.05

    def test_extract_image_dimensions(self):
        original = make_jpeg_bytes(1920, 1080)
        w, h = extract_image_dimensions(original)
        assert w == 1920
        assert h == 1080

    def test_watermark_with_zero_opacity(self):
        """Zero opacity should still produce a valid image."""
        original = make_jpeg_bytes()
        result = apply_watermark(original, opacity=0.0)
        assert isinstance(result, bytes)
        img = Image.open(io.BytesIO(result))
        assert img.format == "JPEG"


# ─── Download Token ───────────────────────────────────────────────────────────


class TestDownloadToken:
    def test_generate_and_verify_round_trip(self):
        token_data = generate_download_token("photo-123", "user-456")
        assert "token" in token_data
        assert "expires_at" in token_data

        payload = verify_download_token(token_data["token"])
        assert payload is not None
        assert payload["photo_id"] == "photo-123"
        assert payload["user_id"] == "user-456"

    def test_tampered_token_returns_none(self):
        token_data = generate_download_token("photo-123", "user-456")
        tampered = token_data["token"] + "garbage"
        result = verify_download_token(tampered)
        assert result is None

    def test_expired_token_returns_none(self):
        from freezegun import freeze_time
        from django.utils import timezone
        import datetime

        with freeze_time("2026-01-01 12:00:00"):
            token_data = generate_download_token("photo-abc", "user-xyz")

        # Advance past token TTL (default 1 hour)
        with freeze_time("2026-01-01 14:00:00"):
            result = verify_download_token(token_data["token"])
        assert result is None

    def test_empty_token_returns_none(self):
        assert verify_download_token("") is None

    def test_random_string_returns_none(self):
        assert verify_download_token("not-a-token-at-all") is None


# ─── Photo Upload ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPhotoUpload:
    url = "/api/photos/upload/"

    @patch("apps.photos.views.process_watermark.apply_async")
    @patch("apps.photos.views.get_storage_service")
    def test_admin_can_upload_photo(self, mock_storage, mock_task, api_client, admin, client_user):
        mock_storage.return_value.upload = MagicMock()
        mock_task.return_value = MagicMock(id="celery-task-abc")

        gallery = GalleryFactory(client=client_user)
        auth(api_client, admin, "adminpass")

        upload_file = make_upload_file()
        resp = api_client.post(self.url, {
            "photo": upload_file,
            "gallery_id": str(gallery.id),
        }, format="multipart")

        assert resp.status_code == status.HTTP_202_ACCEPTED
        assert len(resp.data["data"]["photos"]) == 1
        assert resp.data["data"]["photos"][0]["status"] == "pending"

    def test_client_cannot_upload(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        auth(api_client, client_user)

        upload_file = make_upload_file()
        resp = api_client.post(self.url, {
            "photo": upload_file,
            "gallery_id": str(gallery.id),
        }, format="multipart")

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_upload_without_gallery_id_fails(self, api_client, admin):
        auth(api_client, admin, "adminpass")
        upload_file = make_upload_file()
        resp = api_client.post(self.url, {"photo": upload_file}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_to_nonexistent_gallery_fails(self, api_client, admin):
        auth(api_client, admin, "adminpass")
        import uuid
        upload_file = make_upload_file()
        resp = api_client.post(self.url, {
            "photo": upload_file,
            "gallery_id": str(uuid.uuid4()),
        }, format="multipart")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ─── Photo List ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPhotoList:
    def test_client_sees_own_gallery_photos(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        PhotoFactory.create_batch(5, gallery=gallery)
        auth(api_client, client_user)

        resp = api_client.get(f"/api/galleries/{gallery.id}/photos/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["meta"]["total"] == 5

    def test_client_cannot_see_other_gallery_photos(self, api_client, client_user):
        from apps.users.tests.factories import UserFactory
        other = UserFactory()
        gallery = GalleryFactory(client=other)
        PhotoFactory.create_batch(3, gallery=gallery)
        auth(api_client, client_user)

        resp = api_client.get(f"/api/galleries/{gallery.id}/photos/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_pagination_works(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        PhotoFactory.create_batch(35, gallery=gallery)
        auth(api_client, client_user)

        resp = api_client.get(f"/api/galleries/{gallery.id}/photos/", {"per_page": 10, "page": 1})
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["data"]) == 10
        assert resp.data["meta"]["total"] == 35
        assert resp.data["meta"]["total_pages"] == 4


# ─── Download Token Generation ────────────────────────────────────────────────


@pytest.mark.django_db
class TestPhotoDownloadEndpoint:
    def test_purchased_photo_generates_token(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        photo = PhotoFactory(gallery=gallery, is_purchased=True, status="ready")
        auth(api_client, client_user)

        resp = api_client.post(f"/api/photos/{photo.id}/download/")
        assert resp.status_code == status.HTTP_200_OK
        assert "url" in resp.data["data"]
        assert "token" in resp.data["data"]
        assert "expires_at" in resp.data["data"]

    def test_unpurchased_photo_returns_402(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        photo = PhotoFactory(gallery=gallery, is_purchased=False, status="ready")
        auth(api_client, client_user)

        resp = api_client.post(f"/api/photos/{photo.id}/download/")
        assert resp.status_code == status.HTTP_402_PAYMENT_REQUIRED

    def test_admin_can_download_any_photo(self, api_client, admin, client_user):
        gallery = GalleryFactory(client=client_user)
        photo = PhotoFactory(gallery=gallery, is_purchased=False, status="ready")
        auth(api_client, admin, "adminpass")

        resp = api_client.post(f"/api/photos/{photo.id}/download/")
        assert resp.status_code == status.HTTP_200_OK

    def test_processing_photo_returns_error(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        photo = PhotoFactory(gallery=gallery, is_purchased=True, status="processing")
        auth(api_client, client_user)

        resp = api_client.post(f"/api/photos/{photo.id}/download/")
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# ─── Favorites ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPhotoFavorite:
    def test_toggle_favorite_on(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        photo = PhotoFactory(gallery=gallery)
        auth(api_client, client_user)

        resp = api_client.post(f"/api/photos/{photo.id}/favorite/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["is_favorited"] is True

    def test_toggle_favorite_off(self, api_client, client_user):
        from apps.photos.models import PhotoFavorite
        gallery = GalleryFactory(client=client_user)
        photo = PhotoFactory(gallery=gallery)
        PhotoFavorite.objects.create(user=client_user, photo=photo)
        auth(api_client, client_user)

        resp = api_client.post(f"/api/photos/{photo.id}/favorite/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["is_favorited"] is False

    def test_favorite_requires_auth(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        photo = PhotoFactory(gallery=gallery)

        resp = api_client.post(f"/api/photos/{photo.id}/favorite/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

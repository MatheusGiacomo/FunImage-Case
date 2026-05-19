"""
apps/galleries/tests/test_galleries.py
Tests for gallery CRUD, ownership scoping, and share tokens.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.tests.factories import UserFactory, AdminUserFactory
from apps.photos.tests.factories import GalleryFactory, PublicGalleryFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_user(db):
    return UserFactory(password="pass1234")


@pytest.fixture
def other_client(db):
    return UserFactory(password="pass1234")


@pytest.fixture
def admin(db):
    return AdminUserFactory(password="adminpass")


def auth(api_client, user, password="pass1234"):
    resp = api_client.post("/api/auth/login/", {"email": user.email, "password": password}, format="json")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return api_client


# ─── List ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGalleryList:
    url = "/api/galleries/"

    def test_client_only_sees_own_galleries(self, api_client, client_user, other_client):
        GalleryFactory.create_batch(3, client=client_user)
        GalleryFactory.create_batch(2, client=other_client)
        auth(api_client, client_user)

        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["meta"]["total"] == 3

    def test_admin_sees_all_galleries(self, api_client, client_user, other_client, admin):
        GalleryFactory.create_batch(3, client=client_user)
        GalleryFactory.create_batch(2, client=other_client)
        auth(api_client, admin, "adminpass")

        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["meta"]["total"] == 5

    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_search_by_name(self, api_client, client_user):
        GalleryFactory(name="Casamento Magnífico", client=client_user)
        GalleryFactory(name="Ensaio Fotográfico", client=client_user)
        auth(api_client, client_user)

        resp = api_client.get(self.url, {"search": "Casamento"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["meta"]["total"] == 1
        assert "Casamento" in resp.data["data"][0]["name"]


# ─── Create ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGalleryCreate:
    url = "/api/galleries/"

    def test_admin_creates_gallery_for_client(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        resp = api_client.post(self.url, {
            "name": "Festa de Formatura",
            "description": "Turma 2025",
            "is_public": False,
            "client_id": str(client_user.id),
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["data"]["name"] == "Festa de Formatura"

    def test_client_creates_gallery_for_self(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.post(self.url, {
            "name": "Minha Galeria",
            "is_public": False,
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_create_missing_name(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        resp = api_client.post(self.url, {"client_id": str(client_user.id)}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_cannot_create(self, api_client):
        resp = api_client.post(self.url, {"name": "Test"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ─── Retrieve / Update / Delete ───────────────────────────────────────────────


@pytest.mark.django_db
class TestGalleryDetail:
    def test_client_retrieves_own_gallery(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        auth(api_client, client_user)

        resp = api_client.get(f"/api/galleries/{gallery.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["id"] == str(gallery.id)

    def test_client_cannot_retrieve_others_gallery(self, api_client, client_user, other_client):
        gallery = GalleryFactory(client=other_client)
        auth(api_client, client_user)

        resp = api_client.get(f"/api/galleries/{gallery.id}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_admin_can_update_any_gallery(self, api_client, admin, client_user):
        gallery = GalleryFactory(client=client_user)
        auth(api_client, admin, "adminpass")

        resp = api_client.patch(f"/api/galleries/{gallery.id}/", {"name": "Novo Nome"}, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_soft_delete(self, api_client, admin, client_user):
        gallery = GalleryFactory(client=client_user)
        gallery_id = gallery.id
        auth(api_client, admin, "adminpass")

        resp = api_client.delete(f"/api/galleries/{gallery_id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        # Should not appear in list
        list_resp = api_client.get("/api/galleries/")
        ids = [g["id"] for g in list_resp.data["data"]]
        assert str(gallery_id) not in ids


# ─── Share ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGalleryShare:
    def test_share_generates_url(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user)
        auth(api_client, client_user)

        resp = api_client.post(f"/api/galleries/{gallery.id}/share/")
        assert resp.status_code == status.HTTP_200_OK
        assert "share_url" in resp.data["data"]
        assert gallery.share_token in resp.data["data"]["share_url"]

    def test_shared_gallery_accessible_without_auth(self, api_client, client_user):
        gallery = PublicGalleryFactory(client=client_user)

        resp = api_client.get(f"/api/galleries/shared/{gallery.share_token}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["id"] == str(gallery.id)

    def test_private_gallery_not_accessible_via_share(self, api_client, client_user):
        gallery = GalleryFactory(client=client_user, is_public=False)

        resp = api_client.get(f"/api/galleries/shared/{gallery.share_token}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_share_makes_token_invalid(self, api_client, client_user):
        gallery = PublicGalleryFactory(client=client_user)
        old_token = gallery.share_token
        auth(api_client, client_user)

        api_client.post(f"/api/galleries/{gallery.id}/revoke-share/")

        resp = api_client.get(f"/api/galleries/shared/{old_token}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

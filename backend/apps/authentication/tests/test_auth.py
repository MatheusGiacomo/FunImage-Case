"""
apps/authentication/tests/test_auth.py
Tests for JWT login, logout, refresh, and /me endpoint.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.tests.factories import UserFactory, AdminUserFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory(password="securepass123")


@pytest.fixture
def admin(db):
    return AdminUserFactory(password="adminpass123")


@pytest.fixture
def auth_client(client, user):
    """Returns APIClient authenticated as a regular client user."""
    response = client.post(
        reverse("v1:auth:login"),
        {"email": user.email, "password": "securepass123"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['data']['access']}")
    return client, response.data["data"]


# ─── Login ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestLogin:
    url = "/api/auth/login/"

    def test_login_success(self, client, user):
        resp = client.post(self.url, {"email": user.email, "password": "securepass123"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.data["data"]
        assert "access" in data
        assert "refresh" in data
        assert data["user"]["email"] == user.email
        assert data["user"]["role"] == "client"

    def test_login_wrong_password(self, client, user):
        resp = client.post(self.url, {"email": user.email, "password": "wrongpass"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED
        assert resp.data["success"] is False

    def test_login_nonexistent_user(self, client):
        resp = client.post(self.url, {"email": "ghost@test.com", "password": "pass"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_inactive_user(self, client, db):
        inactive = UserFactory(is_active=False, password="pass123")
        resp = client.post(self.url, {"email": inactive.email, "password": "pass123"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_missing_fields(self, client):
        resp = client.post(self.url, {"email": "only@email.com"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_login_has_is_admin_true(self, client, admin):
        resp = client.post(self.url, {"email": admin.email, "password": "adminpass123"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["user"]["role"] == "admin"


# ─── Refresh Token ────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTokenRefresh:
    url = "/api/auth/token/refresh/"

    def test_refresh_returns_new_access_token(self, client, user):
        login = client.post("/api/auth/login/", {"email": user.email, "password": "securepass123"}, format="json")
        refresh = login.data["data"]["refresh"]

        resp = client.post(self.url, {"refresh": refresh}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.data["data"]

    def test_refresh_with_invalid_token(self, client):
        resp = client.post(self.url, {"refresh": "not.a.token"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_rotates_token(self, client, user):
        """After refresh, the old refresh token must be blacklisted."""
        login = client.post("/api/auth/login/", {"email": user.email, "password": "securepass123"}, format="json")
        original_refresh = login.data["data"]["refresh"]

        # First refresh — succeeds
        resp1 = client.post(self.url, {"refresh": original_refresh}, format="json")
        assert resp1.status_code == status.HTTP_200_OK

        # Second refresh with original — must fail (blacklisted)
        resp2 = client.post(self.url, {"refresh": original_refresh}, format="json")
        assert resp2.status_code == status.HTTP_401_UNAUTHORIZED


# ─── Logout ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestLogout:
    url = "/api/auth/logout/"

    def test_logout_blacklists_token(self, client, user):
        login = client.post("/api/auth/login/", {"email": user.email, "password": "securepass123"}, format="json")
        tokens = login.data["data"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        resp = client.post(self.url, {"refresh": tokens["refresh"]}, format="json")
        assert resp.status_code == status.HTTP_200_OK

        # Refresh after logout must fail
        client.credentials()
        refresh_resp = client.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json")
        assert refresh_resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_requires_auth(self, client):
        resp = client.post(self.url, {"refresh": "sometoken"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_missing_refresh_token(self, client, user):
        login = client.post("/api/auth/login/", {"email": user.email, "password": "securepass123"}, format="json")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['data']['access']}")
        resp = client.post(self.url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ─── /me ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestMe:
    url = "/api/auth/me/"

    def test_me_returns_current_user(self, auth_client, user):
        client, _ = auth_client
        resp = client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["email"] == user.email
        assert resp.data["data"]["id"] == str(user.id)

    def test_me_unauthenticated(self, client):
        resp = client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

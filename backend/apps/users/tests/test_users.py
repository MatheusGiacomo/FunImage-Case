"""
apps/users/tests/test_users.py
Tests for user CRUD, profile management, and password change.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.tests.factories import UserFactory, AdminUserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_user(db):
    return UserFactory(password="pass1234")


@pytest.fixture
def other_user(db):
    return UserFactory(password="pass1234")


@pytest.fixture
def admin(db):
    return AdminUserFactory(password="adminpass")


def auth(api_client, user, password="pass1234"):
    resp = api_client.post(
        "/api/auth/login/",
        {"email": user.email, "password": password},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, f"Auth failed: {resp.data}"
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return api_client


# ─── List ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserList:
    url = "/api/users/"

    def test_admin_can_list_users(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["meta"]["total"] >= 2

    def test_client_cannot_list_users(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_list(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ─── Create ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserCreate:
    url = "/api/users/"

    def test_admin_creates_client_user(self, api_client, admin):
        auth(api_client, admin, "adminpass")
        resp = api_client.post(self.url, {
            "email": "novo@cliente.com",
            "name": "Novo Cliente",
            "password": "senhaSegura123",
            "role": "client",
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["data"]["email"] == "novo@cliente.com"
        assert resp.data["data"]["role"] == "client"

    def test_admin_creates_admin_user(self, api_client, admin):
        auth(api_client, admin, "adminpass")
        resp = api_client.post(self.url, {
            "email": "outro@admin.com",
            "name": "Outro Admin",
            "password": "senhaSegura123",
            "role": "admin",
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["data"]["role"] == "admin"

    def test_client_cannot_create_user(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.post(self.url, {
            "email": "outro@user.com",
            "name": "Outro",
            "password": "senhaSegura123",
            "role": "client",
        }, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_duplicate_email_returns_400(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        resp = api_client.post(self.url, {
            "email": client_user.email,
            "name": "Duplicado",
            "password": "senhaSegura123",
            "role": "client",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_short_password_returns_400(self, api_client, admin):
        auth(api_client, admin, "adminpass")
        resp = api_client.post(self.url, {
            "email": "curto@senha.com",
            "name": "Senha Curta",
            "password": "abc",
            "role": "client",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_required_fields(self, api_client, admin):
        auth(api_client, admin, "adminpass")
        resp = api_client.post(self.url, {"email": "incompleto@test.com"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ─── Retrieve ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserRetrieve:
    def test_admin_retrieves_any_user(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        resp = api_client.get(f"/api/users/{client_user.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["id"] == str(client_user.id)

    def test_client_retrieves_own_profile(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.get(f"/api/users/{client_user.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["email"] == client_user.email

    def test_password_not_exposed(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        resp = api_client.get(f"/api/users/{client_user.id}/")
        assert "password" not in resp.data["data"]


# ─── Me endpoint ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserMe:
    url = "/api/users/me/"

    def test_me_returns_own_data(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["email"] == client_user.email
        assert resp.data["data"]["id"] == str(client_user.id)

    def test_me_patch_updates_name(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.patch(self.url, {"name": "Nome Atualizado"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["name"] == "Nome Atualizado"

    def test_me_patch_updates_phone(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.patch(self.url, {"phone": "+55 11 99999-0000"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["phone"] == "+55 11 99999-0000"

    def test_me_cannot_change_role(self, api_client, client_user):
        """Role is read-only on the update serializer — patch should be ignored."""
        auth(api_client, client_user)
        resp = api_client.patch(self.url, {"role": "admin"}, format="json")
        # Either 200 with role unchanged or 400 — must NOT become admin
        client_user.refresh_from_db()
        assert client_user.role == "client"

    def test_me_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ─── Change Password ──────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestChangePassword:
    url = "/api/users/me/change-password/"

    def test_change_password_success(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.post(self.url, {
            "current_password": "pass1234",
            "new_password": "novaSenha456",
            "confirm_password": "novaSenha456",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK

        # Old credentials must no longer work
        api_client.credentials()
        old_login = api_client.post(
            "/api/auth/login/",
            {"email": client_user.email, "password": "pass1234"},
            format="json",
        )
        assert old_login.status_code == status.HTTP_401_UNAUTHORIZED

    def test_wrong_current_password(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.post(self.url, {
            "current_password": "errada123",
            "new_password": "novaSenha456",
            "confirm_password": "novaSenha456",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_passwords_do_not_match(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.post(self.url, {
            "current_password": "pass1234",
            "new_password": "novaSenha456",
            "confirm_password": "diferente789",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_new_password_too_short(self, api_client, client_user):
        auth(api_client, client_user)
        resp = api_client.post(self.url, {
            "current_password": "pass1234",
            "new_password": "abc",
            "confirm_password": "abc",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_cannot_change_password(self, api_client):
        resp = api_client.post(self.url, {
            "current_password": "qualquer",
            "new_password": "novaSenha456",
            "confirm_password": "novaSenha456",
        }, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ─── Deactivate (soft delete) ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserDeactivate:
    def test_admin_deactivates_user(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        resp = api_client.delete(f"/api/users/{client_user.id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        # User must no longer appear in active list
        list_resp = api_client.get("/api/users/")
        ids = [u["id"] for u in list_resp.data["data"]]
        assert str(client_user.id) not in ids

    def test_deactivated_user_cannot_login(self, api_client, admin, client_user):
        auth(api_client, admin, "adminpass")
        api_client.delete(f"/api/users/{client_user.id}/")

        api_client.credentials()
        login_resp = api_client.post(
            "/api/auth/login/",
            {"email": client_user.email, "password": "pass1234"},
            format="json",
        )
        assert login_resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_client_cannot_deactivate_other(self, api_client, client_user, other_user):
        auth(api_client, client_user)
        resp = api_client.delete(f"/api/users/{other_user.id}/")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

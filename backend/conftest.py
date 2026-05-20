"""
conftest.py
Global pytest fixtures and configuration.
"""

import pytest


def pytest_configure(config):
    """Set DJANGO_ENV=test so settings use eager Celery."""
    import os
    os.environ.setdefault("DJANGO_ENV", "test")
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


@pytest.fixture(scope="session")
def django_db_setup():
    """Use the test database defined in settings.TEST."""
    pass


@pytest.fixture(autouse=True)
def reset_cache(settings):
    """Clear Redis cache between tests."""
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def user(db):
    from apps.users.tests.factories import UserFactory
    return UserFactory(password="testpass123")


@pytest.fixture
def admin(db):
    from apps.users.tests.factories import AdminUserFactory
    return AdminUserFactory(password="adminpass123")


@pytest.fixture
def auth_api_client(api_client, user):
    """APIClient authenticated as a client user."""
    resp = api_client.post(
        "/api/auth/login/",
        {"email": user.email, "password": "testpass123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return api_client


@pytest.fixture
def admin_api_client(api_client, admin):
    """APIClient authenticated as admin."""
    resp = api_client.post(
        "/api/auth/login/",
        {"email": admin.email, "password": "adminpass123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return api_client

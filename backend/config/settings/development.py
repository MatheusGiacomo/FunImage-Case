"""
config/settings/development.py
Development-specific settings — verbose, permissive, local DBs.
"""

from .base import *  # noqa: F401, F403
import os

DEBUG = True

SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-dev-key-do-not-use-in-production-ever-change-this",
)

ALLOWED_HOSTS = ["*"]

# ─── CORS ─────────────────────────────────────────────────────────────────────

CORS_ALLOW_ALL_ORIGINS = True

# ─── Databases ────────────────────────────────────────────────────────────────

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "fotopro"),
        "USER": os.environ.get("POSTGRES_USER", "fotopro"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "fotopro"),
        "HOST": os.environ.get("POSTGRES_HOST", "postgres"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
        "ATOMIC_REQUESTS": True,  # Opcional: Garante transações por request
        "OPTIONS": {
            "connect_timeout": 10,
            # Removido a linha "options": "-c ..." que estava causando o erro FATAL
        },
        "TEST": {"NAME": "fotopro_test"},
    }
}

# ─── Email ────────────────────────────────────────────────────────────────────

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ─── Debug Toolbar ────────────────────────────────────────────────────────────

try:
    import debug_toolbar  # noqa
    INSTALLED_APPS += ["debug_toolbar"]  # noqa
    MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE  # noqa
    INTERNAL_IPS = ["127.0.0.1"]
    DEBUG_TOOLBAR_CONFIG = {"SHOW_TOOLBAR_CALLBACK": lambda request: DEBUG}
except ImportError:
    pass

# ─── Logging (verbose in dev) ─────────────────────────────────────────────────

LOGGING["loggers"]["apps"]["level"] = "DEBUG"  # noqa
LOGGING["loggers"]["django.db.backends"]["level"] = "INFO"  # noqa (show SQL)

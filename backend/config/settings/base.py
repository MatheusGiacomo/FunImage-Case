"""
config/settings/base.py
Base settings — shared across all environments.
Environment-specific overrides live in development.py / production.py.
"""

from pathlib import Path
from datetime import timedelta
import os

# ─── Paths ───────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ─── Application ──────────────────────────────────────────────────────────────

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "django_celery_beat",
    "django_celery_results",
    "django_prometheus",
    "storages",
]

LOCAL_APPS = [
    "apps.core",
    "apps.users",
    "apps.authentication",
    "apps.galleries",
    "apps.photos",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ─── Middleware ───────────────────────────────────────────────────────────────

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.RequestIDMiddleware",
    "apps.core.middleware.RequestLoggingMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

# ─── URLs & WSGI ──────────────────────────────────────────────────────────────

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ─── Templates ────────────────────────────────────────────────────────────────

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ─── Auth ─────────────────────────────────────────────────────────────────────

AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── REST Framework ───────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "apps.core.renderers.SuccessRenderer",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 30,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/min",
        "user": "200/min",
        "upload": "50/hour",
        "download": "100/hour",
    },
}

# ─── JWT ──────────────────────────────────────────────────────────────────────

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "apps.authentication.serializers.CustomTokenObtainPairSerializer",
}

# ─── Spectacular (OpenAPI) ────────────────────────────────────────────────────

SPECTACULAR_SETTINGS = {
    "TITLE": "FotoPro API",
    "DESCRIPTION": (
        "API REST para plataforma de venda e entrega de fotografias profissionais. "
        "Suporte a upload múltiplo, marca d'água automática, galerias por cliente "
        "e download seguro com URL assinada."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "CONTACT": {"email": "dev@fotopro.com"},
    "LICENSE": {"name": "Proprietary"},
    "TAGS": [
        {"name": "Auth", "description": "Autenticação e gerenciamento de tokens JWT"},
        {"name": "Users", "description": "Gerenciamento de usuários"},
        {"name": "Galleries", "description": "Galerias de fotos por cliente"},
        {"name": "Photos", "description": "Upload, watermark e download de fotos"},
    ],
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
}

# ─── Databases ────────────────────────────────────────────────────────────────
# Defined in environment-specific settings files

# ─── Cache (Redis) ────────────────────────────────────────────────────────────

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://redis:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SERIALIZER": "django_redis.serializers.json.JSONSerializer",
            "CONNECTION_POOL_KWARGS": {"max_connections": 50},
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
        },
        "KEY_PREFIX": "fotopro",
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ─── Celery ───────────────────────────────────────────────────────────────────

CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://redis:6379/1")
CELERY_RESULT_BACKEND = "django-db"
CELERY_CACHE_BACKEND = "default"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "America/Sao_Paulo"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300          # 5 min hard limit per task
CELERY_TASK_SOFT_TIME_LIMIT = 240     # 4 min soft limit
CELERY_WORKER_PREFETCH_MULTIPLIER = 1 # Prevent worker starvation
CELERY_TASK_ACKS_LATE = True          # ACK after task completes (safer)
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True  # Suppress CPendingDeprecationWarning
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

CELERY_TASK_ROUTES = {
    "apps.photos.tasks.process_watermark": {"queue": "watermark"},
    "apps.photos.tasks.generate_thumbnail": {"queue": "watermark"},
    "apps.photos.tasks.upload_to_s3": {"queue": "storage"},
    "apps.photos.tasks.cleanup_temp_files": {"queue": "maintenance"},
}

CELERY_TASK_QUEUES_DEFAULT_EXCHANGE = "fotopro"

# ─── Storage ─────────────────────────────────────────────────────────────────

USE_S3 = os.environ.get("USE_S3", "False") == "True"

if USE_S3:
    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME", "fotopro-media")
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME", "us-east-1")
    AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL")  # MinIO in dev
    AWS_S3_CUSTOM_DOMAIN = os.environ.get("AWS_CLOUDFRONT_DOMAIN")  # CDN
    AWS_DEFAULT_ACL = "private"
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 3600  # Signed URL TTL: 1 hour
    AWS_S3_FILE_OVERWRITE = False

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "bucket_name": AWS_STORAGE_BUCKET_NAME,
                "location": "media",
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
else:
    MEDIA_ROOT = BASE_DIR / "media"
    MEDIA_URL = "/media/"
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }

# ─── Static ───────────────────────────────────────────────────────────────────

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [d for d in [BASE_DIR / "static"] if d.exists()]

# ─── Photo Processing ─────────────────────────────────────────────────────────

WATERMARK_TEXT = os.environ.get("WATERMARK_TEXT", "© FotoPro")
WATERMARK_OPACITY = float(os.environ.get("WATERMARK_OPACITY", "0.35"))
WATERMARK_FONT_SCALE = float(os.environ.get("WATERMARK_FONT_SCALE", "0.05"))  # 5% of image width
THUMBNAIL_SIZE = (800, 800)
THUMBNAIL_QUALITY = 85
ACCEPTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_SIZE_MB = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "50"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# ─── Purchase / Download unlock ───────────────────────────────────────────────
# Static access code used to unlock photo/album downloads.
# Override via PURCHASE_ACCESS_CODE env var in production.
PURCHASE_ACCESS_CODE = os.environ.get("PURCHASE_ACCESS_CODE", "121212")

# Public-facing MinIO/S3 endpoint used to rewrite presigned URLs so browsers
# can resolve them. In Docker Compose the internal endpoint is http://minio:9000
# but browsers can only reach http://localhost:9000.
# Set MINIO_PUBLIC_URL explicitly in production (e.g. to your CDN or public S3 URL).
MINIO_PUBLIC_URL = os.environ.get(
    "MINIO_PUBLIC_URL",
    os.environ.get("AWS_S3_ENDPOINT_URL", "").replace("//minio:", "//localhost:"),
)

# ─── Download Token ───────────────────────────────────────────────────────────

DOWNLOAD_TOKEN_SECRET = os.environ.get("DOWNLOAD_TOKEN_SECRET", "change-me-in-production")
DOWNLOAD_TOKEN_MAX_AGE = int(os.environ.get("DOWNLOAD_TOKEN_MAX_AGE", "3600"))  # 1 hour

# ─── MongoDB ─────────────────────────────────────────────────────────────────

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017")
MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "fotopro_meta")

# ─── Internationalization ─────────────────────────────────────────────────────

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

# ─── Default primary key ──────────────────────────────────────────────────────

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── Logging ──────────────────────────────────────────────────────────────────

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} [{levelname}] {name} {request_id} — {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "filters": {
        "request_id": {"()": "apps.core.logging.RequestIDFilter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "filters": ["request_id"],
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.db.backends": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "celery": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
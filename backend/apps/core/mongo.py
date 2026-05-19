import logging
from functools import lru_cache
from typing import Optional

import pymongo
# IMPORTANTE: No PyMongo 4+, você deve importar as classes diretamente para usá-las como Type Hints
from pymongo.database import Database
from pymongo.collection import Collection
from django.conf import settings

logger = logging.getLogger(__name__)

# ─── Sync Client (pymongo) ────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_mongo_client() -> pymongo.MongoClient:
    """Singleton sync MongoDB client."""
    client = pymongo.MongoClient(
        settings.MONGO_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        maxPoolSize=10,
    )
    logger.info("MongoDB client initialized: %s/%s", settings.MONGO_URI, settings.MONGO_DB_NAME)
    return client


def get_mongo_db() -> Database:  # Alterado de pymongo.database.Database para Database
    """Return the application database."""
    return get_mongo_client()[settings.MONGO_DB_NAME]


# ─── Collections ──────────────────────────────────────────────────────────────


def get_photo_metadata_collection() -> Collection:  # Alterado para Collection
    """
    photo_metadata collection — stores EXIF and processing metadata.
    """
    db = get_mongo_db()
    col = db["photo_metadata"]
    # Ensure indexes on startup
    col.create_index("photo_id", unique=True, background=True)
    col.create_index("exif.taken_at", background=True)
    return col


def get_audit_log_collection() -> Collection:  # Alterado para Collection
    """
    audit_log collection — immutable audit trail for sensitive operations.
    """
    db = get_mongo_db()
    col = db["audit_log"]
    col.create_index("user_id", background=True)
    col.create_index("event", background=True)
    col.create_index("created_at", background=True)
    # Auto-expire audit logs after 2 years (LGPD compliance)
    col.create_index(
        "created_at",
        expireAfterSeconds=63_072_000,
        name="ttl_2years",
        background=True,
    )
    return col


# ─── Helpers ──────────────────────────────────────────────────────────────────


def ping_mongo() -> bool:
    """Check MongoDB connectivity."""
    try:
        get_mongo_client().admin.command("ping")
        return True
    except Exception:
        return False
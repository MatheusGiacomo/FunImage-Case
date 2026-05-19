"""
apps/core/views.py
Health check endpoint — verifies connectivity to all backing services.
Returns 200 if healthy, 503 if any critical service is down.
"""

import time
import logging
from django.db import connections
from django.db.utils import OperationalError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def _check_postgres() -> dict:
    start = time.perf_counter()
    try:
        connections["default"].ensure_connection()
        return {"status": "ok", "latency_ms": round((time.perf_counter() - start) * 1000, 1)}
    except OperationalError as e:
        return {"status": "error", "error": str(e)}


def _check_redis() -> dict:
    start = time.perf_counter()
    try:
        from django.core.cache import cache
        cache.set("health_check", "ok", timeout=5)
        val = cache.get("health_check")
        if val != "ok":
            raise ValueError("Cache read/write mismatch")
        return {"status": "ok", "latency_ms": round((time.perf_counter() - start) * 1000, 1)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _check_mongo() -> dict:
    start = time.perf_counter()
    try:
        from apps.core.mongo import ping_mongo
        if not ping_mongo():
            raise ConnectionError("Ping failed")
        return {"status": "ok", "latency_ms": round((time.perf_counter() - start) * 1000, 1)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    GET /api/health/
    Returns service health status. Used by Docker, load balancers, and uptime monitors.
    """
    checks = {
        "postgres": _check_postgres(),
        "redis": _check_redis(),
        "mongo": _check_mongo(),
    }

    all_ok = all(v["status"] == "ok" for v in checks.values())
    http_status = status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE

    return Response(
        {
            "status": "healthy" if all_ok else "degraded",
            "services": checks,
        },
        status=http_status,
    )

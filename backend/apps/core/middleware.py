"""
apps/core/middleware.py
Cross-cutting middleware: request ID tracing, structured logging.
"""

import time
import uuid
import logging
from threading import local

logger = logging.getLogger(__name__)

# Thread-local storage for request ID (accessible in logging filters)
_request_local = local()


def get_request_id() -> str:
    return getattr(_request_local, "request_id", "")


class RequestIDMiddleware:
    """
    Injects a unique X-Request-ID into every request/response cycle.
    Propagates incoming X-Request-ID headers from load balancers.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get("HTTP_X_REQUEST_ID") or str(uuid.uuid4())
        request.request_id = request_id
        _request_local.request_id = request_id

        response = self.get_response(request)
        response["X-Request-ID"] = request_id
        return response


class RequestLoggingMiddleware:
    """
    Logs all HTTP requests with method, path, status, duration, and request ID.
    Skips health-check and static file paths to reduce noise.
    """

    SKIP_PATHS = frozenset(["/health/", "/metrics", "/static/", "/favicon.ico"])

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if any(request.path.startswith(p) for p in self.SKIP_PATHS):
            return self.get_response(request)

        start = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "%s %s → %s (%.1fms) [%s]",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
            getattr(request, "request_id", "-"),
            extra={
                "http_method": request.method,
                "http_path": request.path,
                "http_status": response.status_code,
                "duration_ms": round(duration_ms, 1),
                "user_id": str(request.user.id) if request.user.is_authenticated else None,
            },
        )

        # Warn on slow requests
        if duration_ms > 2000:
            logger.warning(
                "Slow request: %s %s took %.0fms",
                request.method,
                request.path,
                duration_ms,
            )

        return response

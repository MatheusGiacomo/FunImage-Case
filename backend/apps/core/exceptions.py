"""
apps/core/exceptions.py
Centralized exception handling — all errors follow the same response envelope.
"""

import logging
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

# ─── Custom Exception Classes ─────────────────────────────────────────────────


class BusinessException(APIException):
    """Domain-level business rule violation."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "A business rule was violated."
    default_code = "business_error"


class ResourceNotFoundException(APIException):
    """Resource not found (typed alternative to Http404)."""

    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested resource was not found."
    default_code = "not_found"


class ConflictException(APIException):
    """State conflict — e.g. duplicate record."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "A conflict occurred with the current state of the resource."
    default_code = "conflict"


class PaymentRequiredException(APIException):
    """Photo not purchased — download blocked."""

    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_detail = "This photo must be purchased before downloading."
    default_code = "payment_required"


class StorageException(APIException):
    """File storage operation failed."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "A storage error occurred."
    default_code = "storage_error"


class FileTooLargeException(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_detail = "The uploaded file exceeds the maximum allowed size."
    default_code = "file_too_large"


class InvalidMimeTypeException(APIException):
    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    default_detail = "The uploaded file type is not supported."
    default_code = "unsupported_media_type"


# ─── Exception Handler ────────────────────────────────────────────────────────


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """
    Transforms all exceptions into a consistent error envelope:

        {
            "success": false,
            "error": {
                "code": "validation_error",
                "message": "...",
                "details": { ... }   # optional field-level errors
            }
        }
    """
    # Convert Django's ValidationError to DRF's
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(detail=exc.message_dict if hasattr(exc, "message_dict") else exc.messages)

    # Convert Http404 to DRF's NotFound
    if isinstance(exc, Http404):
        exc = ResourceNotFoundException()

    # Let DRF handle the rest (sets exc.detail etc.)
    response = exception_handler(exc, context)

    if response is None:
        # Unhandled server error — log and return 500
        logger.exception("Unhandled exception in view", exc_info=exc)
        return Response(
            {
                "success": False,
                "error": {
                    "code": "internal_server_error",
                    "message": "An unexpected error occurred. Please try again later.",
                },
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Normalize the error detail into our envelope
    code = getattr(exc, "default_code", "error")
    detail = response.data

    if isinstance(detail, dict):
        # Field-level validation errors
        message = "Validation failed."
        details = detail
    elif isinstance(detail, list):
        message = detail[0] if detail else "An error occurred."
        details = None
    else:
        message = str(detail)
        details = None

    # Unwrap DRF's ErrorDetail string
    if hasattr(message, "code"):
        code = message.code
    message = str(message)

    error_body: dict[str, Any] = {"code": code, "message": message}
    if details:
        error_body["details"] = {
            k: [str(e) for e in v] if isinstance(v, list) else str(v)
            for k, v in details.items()
        }

    response.data = {"success": False, "error": error_body}

    # Log client errors at WARNING, server errors at ERROR
    if response.status_code >= 500:
        logger.error("API error %s: %s", response.status_code, message, exc_info=exc)
    elif response.status_code >= 400:
        logger.warning("API error %s: %s", response.status_code, message)

    return response

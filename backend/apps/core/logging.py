"""
apps/core/logging.py
Logging filters and formatters.
"""

import logging
from .middleware import get_request_id


class RequestIDFilter(logging.Filter):
    """Injects the current request ID into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        return True

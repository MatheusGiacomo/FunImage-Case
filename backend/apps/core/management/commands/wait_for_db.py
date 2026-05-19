"""
apps/core/management/commands/wait_for_db.py
Waits for PostgreSQL, Redis, and MongoDB to be ready before starting.
Used as a Docker entrypoint guard.
"""

import time
import logging
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Waits until all required databases are available."

    def handle(self, *args, **options):
        self.stdout.write("Waiting for services...")

        self._wait_postgres()
        self._wait_redis()
        self._wait_mongo()

        self.stdout.write(self.style.SUCCESS("All services are ready."))

    def _wait_postgres(self, timeout: int = 60):
        self.stdout.write("  → PostgreSQL...", ending=" ")
        start = time.time()
        while True:
            try:
                conn = connections["default"]
                conn.ensure_connection()
                self.stdout.write(self.style.SUCCESS("OK"))
                return
            except OperationalError:
                elapsed = time.time() - start
                if elapsed > timeout:
                    raise RuntimeError(f"PostgreSQL not ready after {timeout}s")
                time.sleep(1)

    def _wait_redis(self, timeout: int = 30):
        self.stdout.write("  → Redis...", ending=" ")
        import redis
        from django.conf import settings
        start = time.time()
        while True:
            try:
                r = redis.from_url(settings.CELERY_BROKER_URL)
                r.ping()
                self.stdout.write(self.style.SUCCESS("OK"))
                return
            except Exception:
                elapsed = time.time() - start
                if elapsed > timeout:
                    raise RuntimeError(f"Redis not ready after {timeout}s")
                time.sleep(1)

    def _wait_mongo(self, timeout: int = 30):
        self.stdout.write("  → MongoDB...", ending=" ")
        from apps.core.mongo import ping_mongo
        start = time.time()
        while True:
            if ping_mongo():
                self.stdout.write(self.style.SUCCESS("OK"))
                return
            elapsed = time.time() - start
            if elapsed > timeout:
                raise RuntimeError(f"MongoDB not ready after {timeout}s")
            time.sleep(1)

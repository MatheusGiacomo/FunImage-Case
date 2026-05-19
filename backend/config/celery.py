"""
config/celery.py
Celery application — configured for Django with Redis broker.
"""

import os
from celery import Celery
from celery.signals import setup_logging

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("fotopro")

# Load config from Django settings, namespace=CELERY_
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@setup_logging.connect
def config_loggers(*args, **kwargs):
    """Keep Django's logging config in Celery workers."""
    from logging.config import dictConfig
    from django.conf import settings
    dictConfig(settings.LOGGING)


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Health-check task for development."""
    print(f"Request: {self.request!r}")

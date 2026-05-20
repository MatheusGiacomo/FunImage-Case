"""
apps/core/management/commands/create_periodic_tasks.py
Idempotent: registers Celery Beat periodic tasks in the database.
Safe to run multiple times — uses get_or_create.
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Creates or updates Celery Beat periodic task schedules."

    def handle(self, *args, **options):
        from django_celery_beat.models import PeriodicTask, IntervalSchedule
        import json

        self.stdout.write("Registering periodic tasks...")

        # ── Cleanup stale error photos — every 24 hours ────────────────────
        daily, _ = IntervalSchedule.objects.get_or_create(
            every=24, period=IntervalSchedule.HOURS
        )
        PeriodicTask.objects.update_or_create(
            name="Cleanup stale error photos",
            defaults={
                "task": "apps.photos.tasks.cleanup_temp_files",
                "interval": daily,
                "args": json.dumps([]),
                "enabled": True,
            },
        )

        # ── Reprocess stuck photos — every 15 minutes ─────────────────────
        quarter_hour, _ = IntervalSchedule.objects.get_or_create(
            every=15, period=IntervalSchedule.MINUTES
        )
        PeriodicTask.objects.update_or_create(
            name="Reprocess stuck photos",
            defaults={
                "task": "apps.photos.tasks.reprocess_failed_photos",
                "interval": quarter_hour,
                "args": json.dumps([]),
                "enabled": True,
            },
        )

        self.stdout.write(self.style.SUCCESS("Periodic tasks registered successfully."))

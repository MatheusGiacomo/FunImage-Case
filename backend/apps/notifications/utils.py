"""
apps/notifications/utils.py
Centralized notification factory.

All notification creation goes through `notify()` so:
  - there is one place to add logging / rate limiting / dedup
  - views and tasks never import the model directly
  - adding email / push later only requires changing this file
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def notify(
    recipient,
    notification_type: str,
    title: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> None:
    """
    Create a Notification for *recipient* (User instance or user_id str/UUID).
    Silently swallows exceptions so a notification failure never breaks a request.
    """
    try:
        from apps.notifications.models import Notification
        from apps.users.models import User

        # Accept User instance or raw ID
        if not isinstance(recipient, User):
            recipient = User.objects.get(pk=recipient)

        Notification.objects.create(
            recipient=recipient,
            type=notification_type,
            title=title,
            message=message,
            data=data or {},
        )
        logger.debug("Notification created: type=%s recipient=%s", notification_type, recipient.id)
    except Exception as exc:
        logger.warning("Failed to create notification (type=%s): %s", notification_type, exc)


def notify_all_admins(
    notification_type: str,
    title: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> None:
    """Create the same notification for every active admin."""
    try:
        from apps.users.models import User
        for admin in User.objects.admins():
            notify(admin, notification_type, title, message, data)
    except Exception as exc:
        logger.warning("Failed to notify admins (type=%s): %s", notification_type, exc)
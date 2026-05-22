"""
apps/notifications/views.py
Notification endpoints.

GET    /api/notifications/           — paginated list for current user
GET    /api/notifications/unread-count/ — fast badge counter
POST   /api/notifications/:id/read/  — mark one as read
POST   /api/notifications/read-all/  — mark all as read
"""

import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.mixins import ListModelMixin

from .models import Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)


class NotificationViewSet(ListModelMixin, GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Notification.objects
            .filter(recipient=self.request.user, deleted_at__isnull=True)
            .order_by("-created_at")[:50]  # cap at 50 — frontend paginates if needed
        )

    # ── GET /api/notifications/unread-count/ ─────────────────────────────────
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
            deleted_at__isnull=True,
        ).count()
        return Response({"count": count})

    # ── POST /api/notifications/:id/read/ ────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        try:
            notif = Notification.objects.get(
                pk=pk, recipient=request.user, deleted_at__isnull=True
            )
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notif.mark_read()
        return Response(NotificationSerializer(notif).data)

    # ── POST /api/notifications/read-all/ ────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read(self, request):
        updated = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
            deleted_at__isnull=True,
        ).update(is_read=True, read_at=timezone.now())
        return Response({"marked_read": updated})
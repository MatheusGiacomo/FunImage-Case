"""
apps/users/views.py
"""

import logging
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.core.permissions import IsAdmin, IsOwnerOrAdmin
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer, ChangePasswordSerializer

logger = logging.getLogger(__name__)


@extend_schema_view(
    list=extend_schema(tags=["Users"], summary="Listar usuários"),
    create=extend_schema(tags=["Users"], summary="Criar usuário"),
    retrieve=extend_schema(tags=["Users"], summary="Obter usuário"),
    update=extend_schema(tags=["Users"], summary="Atualizar usuário"),
    destroy=extend_schema(tags=["Users"], summary="Desativar usuário"),
)
class UserViewSet(ModelViewSet):
    queryset = User.objects.filter(is_active=True).order_by("-created_at")
    http_method_names = ["get", "post", "patch", "delete"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAdmin()]
        if self.action in ("update", "partial_update", "destroy"):
            return [IsOwnerOrAdmin()]
        if self.action == "list":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        # Soft-deactivate instead of deleting
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        logger.info("User deactivated: %s by %s", instance.id, self.request.user.id)

    @extend_schema(tags=["Users"], summary="Meu perfil")
    @action(detail=False, methods=["get", "patch"], url_path="me", permission_classes=[IsAuthenticated])
    def me(self, request):
        if request.method == "PATCH":
            serializer = UserUpdateSerializer(request.user, data=request.data, partial=True, context={"request": request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(UserSerializer(request.user).data)
        return Response(UserSerializer(request.user).data)

    @extend_schema(tags=["Users"], summary="Alterar senha")
    @action(detail=False, methods=["post"], url_path="me/change-password", permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        logger.info("Password changed for user: %s", request.user.id)
        return Response({"message": "Senha alterada com sucesso."})

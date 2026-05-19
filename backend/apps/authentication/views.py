"""
apps/authentication/views.py
Auth endpoints: login, logout, token refresh, /me.
"""

from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework import status
from drf_spectacular.utils import extend_schema

from apps.users.serializers import UserSerializer


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Returns access + refresh tokens plus user data.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Login",
        description="Autentica o usuário e retorna par de tokens JWT.",
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RefreshTokenView(TokenRefreshView):
    """
    POST /api/auth/token/refresh/
    Rotates the refresh token and returns a new access token.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Renovar token",
        description="Renova o access token usando o refresh token.",
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the refresh token, invalidating the session.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Logout",
        description="Invalida o refresh token, encerrando a sessão.",
    )
    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"message": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {"message": "Token inválido ou já expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"message": "Logout realizado com sucesso."})


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Usuário atual",
        description="Retorna os dados do usuário autenticado.",
    )
    def get(self, request):
        return Response(UserSerializer(request.user).data)

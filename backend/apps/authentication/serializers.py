"""
apps/authentication/serializers.py
JWT customization — inject user role and name into token payload.
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework import serializers


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT pair to include user metadata in the token.
    This avoids extra DB queries on every authenticated request.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Custom claims embedded in the JWT payload
        token["name"] = user.name
        token["email"] = user.email
        token["role"] = user.role
        token["is_admin"] = user.is_admin
        return token

    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except Exception:
            raise AuthenticationFailed("E-mail ou senha incorretos.")

        # Attach user data to response alongside the tokens
        data["user"] = {
            "id": str(self.user.id),
            "name": self.user.name,
            "email": self.user.email,
            "role": self.user.role,
            "avatar_url": self.user.avatar_url,
        }
        return data


class TokenRefreshResponseSerializer(serializers.Serializer):
    """Schema-only serializer for Swagger docs."""
    access = serializers.CharField()

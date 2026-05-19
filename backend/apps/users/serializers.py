"""
apps/users/serializers.py
"""

from rest_framework import serializers
from .models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """Read serializer — safe for returning to any authenticated user."""

    avatar_url = serializers.ReadOnlyField()
    is_admin = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "role", "avatar_url",
            "is_admin", "phone", "created_at", "last_login",
        ]
        read_only_fields = ["id", "email", "role", "created_at", "last_login"]


class UserCreateSerializer(serializers.ModelSerializer):
    """Admin-only: create a new user."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["email", "name", "role", "password", "phone"]

    def validate_role(self, value):
        request = self.context.get("request")
        if request and not request.user.is_admin:
            raise serializers.ValidationError("Você não tem permissão para definir a role.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        role = validated_data.pop("role", UserRole.CLIENT)
        if role == UserRole.ADMIN:
            user = User.objects.create_admin(**validated_data, password=password)
        else:
            user = User.objects.create_user(**validated_data, role=role, password=password)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Self-update — limited fields."""

    class Meta:
        model = User
        fields = ["name", "phone", "avatar"]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")
        return value

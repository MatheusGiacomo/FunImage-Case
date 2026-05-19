"""
apps/users/models.py
Custom User model — extends AbstractBaseUser for full control.
Role-based: admin | client.
"""

import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    ADMIN = "admin", "Administrador"
    CLIENT = "client", "Cliente"


class UserManager(BaseUserManager):
    """Custom manager — email is the unique identifier, not username."""

    def _create_user(self, email: str, password: str, **extra_fields):
        if not email:
            raise ValueError("E-mail is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str = None, **extra_fields):
        extra_fields.setdefault("role", UserRole.CLIENT)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_admin(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("role", UserRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields["role"] = UserRole.ADMIN
        extra_fields["is_staff"] = True
        extra_fields["is_superuser"] = True
        return self._create_user(email, password, **extra_fields)

    def admins(self):
        return self.filter(role=UserRole.ADMIN, is_active=True)

    def clients(self):
        return self.filter(role=UserRole.CLIENT, is_active=True)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Platform user.

    - Uses email as the login identifier.
    - Role field drives all permission logic (no Django groups needed).
    - Avatar stored in S3 / local media.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    email = models.EmailField(unique=True, db_index=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=10, choices=UserRole.choices, default=UserRole.CLIENT, db_index=True)
    avatar = models.ImageField(upload_to="avatars/%Y/%m/", null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "users"
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "is_active"]),
            models.Index(fields=["role", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} <{self.email}>"

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    @property
    def is_client(self) -> bool:
        return self.role == UserRole.CLIENT

    @property
    def avatar_url(self) -> str | None:
        if self.avatar:
            return self.avatar.url
        return None

    def get_full_name(self) -> str:
        return self.name

    def get_short_name(self) -> str:
        return self.name.split()[0] if self.name else self.email.split("@")[0]

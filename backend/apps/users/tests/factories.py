"""
apps/users/tests/factories.py
factory_boy factories — used across the entire test suite.
"""

import factory
from factory.django import DjangoModelFactory
from faker import Faker

fake = Faker("pt_BR")


class UserFactory(DjangoModelFactory):
    class Meta:
        model = "users.User"
        django_get_or_create = ("email",)

    email = factory.LazyFunction(lambda: fake.unique.email())
    name = factory.LazyFunction(lambda: fake.name())
    role = "client"
    is_active = True

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        obj.set_password(extracted or "testpass123")
        if create:
            obj.save(update_fields=["password"])


class AdminUserFactory(UserFactory):
    role = "admin"
    is_staff = True

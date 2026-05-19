"""
apps/photos/tests/factories.py + apps/galleries/tests/factories.py
Shared test factories for galleries and photos.
"""

import io
import factory
from factory.django import DjangoModelFactory
from faker import Faker
from PIL import Image

fake = Faker("pt_BR")


# ─── Gallery Factory ──────────────────────────────────────────────────────────

class GalleryFactory(DjangoModelFactory):
    class Meta:
        model = "galleries.Gallery"

    name = factory.LazyFunction(lambda: fake.sentence(nb_words=3).rstrip("."))
    description = factory.LazyFunction(lambda: fake.paragraph(nb_sentences=2))
    client = factory.SubFactory("apps.users.tests.factories.UserFactory")
    created_by = factory.SelfAttribute("client")
    is_public = False


class PublicGalleryFactory(GalleryFactory):
    is_public = True


# ─── Photo Factory ────────────────────────────────────────────────────────────

def _make_image_bytes(width: int = 800, height: int = 600) -> bytes:
    """Generate a valid JPEG image in memory for testing."""
    img = Image.new("RGB", (width, height), color=(
        fake.random_int(0, 255),
        fake.random_int(0, 255),
        fake.random_int(0, 255),
    ))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


class PhotoFactory(DjangoModelFactory):
    class Meta:
        model = "photos.Photo"

    gallery = factory.SubFactory(GalleryFactory)
    uploaded_by = factory.SelfAttribute("gallery.client")
    filename = factory.LazyFunction(lambda: f"{fake.slug()}.jpg")
    mime_type = "image/jpeg"
    size = factory.LazyFunction(lambda: fake.random_int(50_000, 5_000_000))
    width = factory.LazyFunction(lambda: fake.random_int(800, 4000))
    height = factory.LazyFunction(lambda: fake.random_int(600, 3000))
    original_file = factory.LazyFunction(lambda: f"photos/test/{fake.uuid4()}/original/test.jpg")
    watermarked_file = factory.LazyFunction(lambda: f"photos/test/{fake.uuid4()}/watermarked/test.jpg")
    thumbnail_file = factory.LazyFunction(lambda: f"photos/test/{fake.uuid4()}/thumbnail/test.jpg")
    status = "ready"
    is_purchased = False

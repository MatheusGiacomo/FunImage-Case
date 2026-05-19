import os

env = os.environ.get("DJANGO_ENV", "development")

if env == "production":
    from .production import *  # noqa
elif env == "test":
    from .development import *  # noqa
    CELERY_TASK_ALWAYS_EAGER = True  # Run tasks synchronously in tests
    CELERY_TASK_EAGER_PROPAGATES = True
else:
    from .development import *  # noqa

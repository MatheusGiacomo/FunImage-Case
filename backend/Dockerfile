# Stage 1: Python dependency builder
FROM python:3.12-slim AS builder

WORKDIR /build

# System deps for compiled packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    libmagic-dev \
    libjpeg-dev \
    libpng-dev \
    libwebp-dev \
    libfreetype6-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies into an isolated prefix
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# Stage 2: Production runtime
FROM python:3.12-slim AS production

LABEL maintainer="dev@fotopro.com"
LABEL org.opencontainers.image.title="FotoPro API"
LABEL org.opencontainers.image.description="Django REST API — Photo delivery platform"

# Runtime system libraries only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libmagic1 \
    libjpeg62-turbo \
    libpng16-16 \
    libwebp7 \
    libfreetype6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN groupadd --system fotopro && \
    useradd --system --gid fotopro --home /app --shell /bin/bash fotopro

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application source
COPY --chown=fotopro:fotopro . .

# Create runtime directories
RUN mkdir -p /app/media /app/staticfiles /app/logs && \
    chown -R fotopro:fotopro /app

USER fotopro

# Collect static files at build time
RUN python manage.py collectstatic --noinput --settings=config.settings.production 2>/dev/null || true

EXPOSE 8000

# Healthcheck — hits Django's health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

# Default: gunicorn WSGI server
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--worker-class", "sync", \
     "--worker-connections", "1000", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--timeout", "30", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--log-level", "info", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "config.wsgi:application"]


# Stage 3: Celery worker (same image, different CMD)
FROM production AS celery-worker

CMD ["celery", \
     "-A", "config.celery", \
     "worker", \
     "--loglevel=info", \
     "--concurrency=4", \
     "--queues=watermark,storage,maintenance,celery", \
     "--max-tasks-per-child=500", \
     "--without-gossip", \
     "--without-mingle", \
     "--without-heartbeat"]


# Stage 4: Celery Beat scheduler
FROM production AS celery-beat

CMD ["celery", \
     "-A", "config.celery", \
     "beat", \
     "--loglevel=info", \
     "--scheduler", "django_celery_beat.schedulers:DatabaseScheduler"]


# Stage 5: Development (with dev deps + hot reload)
FROM python:3.12-slim AS development

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    libmagic-dev \
    libjpeg-dev \
    libpng-dev \
    libwebp-dev \
    libfreetype6-dev \
    zlib1g-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements-dev.txt

# Source is mounted as volume in development
EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

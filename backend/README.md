# FotoPro — Backend API

API REST profissional para plataforma de entrega de fotografias. Django 5.1 + DRF + PostgreSQL + MongoDB + Redis + Celery + S3.

---

## Arquitetura

```
fotopro-backend/
├── config/
│   ├── settings/
│   │   ├── base.py          # Configurações compartilhadas
│   │   ├── development.py   # Dev: DEBUG=True, CORS aberto
│   │   └── production.py    # Prod: HTTPS, S3, Sentry
│   ├── urls.py              # Roteamento raiz com versionamento /api/
│   ├── celery.py            # Celery app com auto-discover
│   ├── wsgi.py / asgi.py
│
├── apps/
│   ├── core/                # Base models, exceções, middleware, MongoDB, health
│   ├── users/               # Custom User model (email login, role=admin|client)
│   ├── authentication/      # JWT customizado (claims extras no token)
│   ├── galleries/           # Galerias por cliente, share tokens
│   └── photos/
│       ├── models.py        # Photo + PhotoFavorite
│       ├── views.py         # Upload, download seguro, favoritos
│       ├── tasks.py         # Celery: watermark → EXIF → S3
│       └── services/
│           ├── watermark.py # PIL: aplicação de marca d'água
│           ├── storage.py   # Abstração S3/local + tokens assinados
│           └── exif.py      # Extração EXIF → MongoDB
│
├── docker/
│   ├── nginx/               # Reverse proxy com rate limiting
│   ├── postgres/init.sql    # Extensions + roles + full-text search PT
│   └── mongo/init.js        # Collections + schema validation + TTL indexes
│
├── .github/workflows/ci.yml # CI: lint → test → build → deploy
└── docker-compose.yml       # Stack completa: 9 serviços
```

---

## Stack de Tecnologias

| Tecnologia | Versão | Uso |
|---|---|---|
| **Django** | 5.1.4 | Framework web |
| **Django REST Framework** | 3.15.2 | API REST |
| **SimpleJWT** | 5.3.1 | JWT com blacklist e custom claims |
| **drf-spectacular** | 0.27.2 | Swagger / OpenAPI automático |
| **PostgreSQL** | 16 | Dados estruturados (usuários, galerias, fotos) |
| **MongoDB** | 7 | Metadados EXIF e audit log (esquema flexível) |
| **Redis** | 7 | Cache, sessões, broker Celery |
| **Celery** | 5.4 | Processamento assíncrono de watermark |
| **Pillow** | 11 | Marca d'água, thumbnail, correção EXIF |
| **boto3** | 1.35 | Upload S3 / MinIO |
| **MinIO** | latest | S3-compatible storage local |
| **Nginx** | 1.27 | Reverse proxy, rate limiting, gzip |
| **Gunicorn** | 23 | WSGI server de produção |
| **Sentry** | 2.19 | Observabilidade em produção |

---

## Setup Rápido (Docker)

```bash
# 1. Clonar e configurar variáveis
cp .env.example .env
# Editar .env conforme necessário

# 2. Subir toda a stack
docker compose up -d

# 3. Verificar saúde
curl http://localhost:8000/api/health/
```

### Serviços disponíveis

| Serviço | URL | Credenciais |
|---|---|---|
| API Django | http://localhost:8000/api/ | — |
| Swagger UI | http://localhost:8000/api/docs/ | — |
| ReDoc | http://localhost:8000/api/redoc/ | — |
| Django Admin | http://localhost:8000/admin/ | superuser criado via comando |
| Frontend | http://localhost:3000/ | — |
| Nginx | http://localhost:80/ | — |
| MinIO Console | http://localhost:9001/ | minioadmin / minioadmin |
| Flower (Celery) | http://localhost:5555/ | admin / flowerpass |
| PostgreSQL | localhost:5432 | fotopro / fotopro_dev_pass |
| MongoDB | localhost:27017 | sem auth (dev) |
| Redis | localhost:6379 | sem auth (dev) |

---

## Setup Local (sem Docker)

```bash
# Python 3.12+
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# Variáveis de ambiente
cp .env.example .env
export $(cat .env | xargs)

# Banco e dados iniciais
python manage.py migrate
python manage.py create_periodic_tasks
python manage.py createsuperuser

# Django dev server
python manage.py runserver

# Celery worker (terminal separado)
celery -A config.celery worker --loglevel=info -Q watermark,storage,maintenance

# Celery beat (terminal separado)
celery -A config.celery beat --loglevel=info
```

---

## Testes

```bash
# Todos os testes com coverage
pytest

# Por módulo
pytest apps/authentication/tests/
pytest apps/galleries/tests/
pytest apps/photos/tests/

# Somente testes rápidos (sem @pytest.mark.slow)
pytest -m "not slow"

# Relatório HTML de coverage
pytest && open htmlcov/index.html
```

---

## Fluxo de Upload

```
POST /api/photos/upload/
        │
        ├── 1. Validação de MIME type (python-magic, não Content-Type)
        ├── 2. Validação de tamanho (≤ 50MB)
        ├── 3. Salva original em S3/local
        ├── 4. Cria registro Photo (status=PENDING)
        └── 5. Dispatch Celery task → process_watermark
                    │
                    ├── Aplica marca d'água (PIL) → salva watermarked
                    ├── Gera thumbnail (800×800) → salva thumbnail
                    ├── Extrai EXIF → salva no MongoDB
                    └── Atualiza Photo (status=READY)
```

## Download Seguro

```
POST /api/photos/:id/download/
        │
        └── Gera token assinado (itsdangerous, TTL=1h)
                    │
                    └── URL: GET /api/photos/download/:token/
                                │
                                ├── Verifica assinatura e TTL
                                ├── Resolve URL S3 presigned (ou local)
                                └── Redirect para o arquivo
```

---

## API Reference

Documentação completa disponível em:
- **Swagger UI:** http://localhost:8000/api/docs/
- **ReDoc:** http://localhost:8000/api/redoc/
- **Schema OpenAPI:** http://localhost:8000/api/schema/

### Endpoints principais

```
POST   /api/auth/login/                    Login → tokens JWT
POST   /api/auth/logout/                   Logout (blacklist refresh)
POST   /api/auth/token/refresh/            Renovar access token
GET    /api/auth/me/                       Usuário autenticado

GET    /api/users/                         Listar usuários (admin)
POST   /api/users/                         Criar usuário (admin)
GET    /api/users/me/                      Meu perfil
PATCH  /api/users/me/                      Atualizar perfil
POST   /api/users/me/change-password/      Alterar senha

GET    /api/galleries/                     Listar galerias
POST   /api/galleries/                     Criar galeria
GET    /api/galleries/:id/                 Detalhe da galeria
PATCH  /api/galleries/:id/                 Atualizar galeria
DELETE /api/galleries/:id/                 Deletar (soft)
POST   /api/galleries/:id/share/           Gerar link público
POST   /api/galleries/:id/revoke-share/    Revogar compartilhamento
GET    /api/galleries/shared/:token/       Galeria pública (sem auth)

GET    /api/galleries/:id/photos/          Listar fotos da galeria
POST   /api/photos/upload/                 Upload (admin, multipart)
GET    /api/photos/:id/                    Detalhe da foto
DELETE /api/photos/:id/                    Deletar foto (admin)
POST   /api/photos/:id/download/           Gerar URL de download
POST   /api/photos/:id/favorite/           Favoritar/desfavoritar
GET    /api/photos/download/:token/        Download seguro (token)

GET    /api/health/                        Health check (todos os serviços)
```

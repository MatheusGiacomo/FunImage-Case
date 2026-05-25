# FunImage — Plataforma de Fotografia Profissional

> API REST + Interface Web para gestão, entrega e venda de fotografias profissionais com processamento assíncrono, marca d'água automática e download seguro.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Como Rodar](#como-rodar)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [API Reference](#api-reference)
- [Pipeline de Processamento de Fotos](#pipeline-de-processamento-de-fotos)
- [Modelo de Dados](#modelo-de-dados)
- [Frontend](#frontend)
- [PWA (Progressive Web App)](#pwa-progressive-web-app)
- [Testes](#testes)
- [CI/CD](#cicd)
- [Convenções e Padrões de Código](#convenções-e-padrões-de-código)
- [Serviços e Portas](#serviços-e-portas)

---

## Visão Geral

O FunImage é uma plataforma full-stack voltada para fotógrafos profissionais. O fotógrafo (admin) faz upload de fotos, organiza-as em galerias por cliente, e o sistema automaticamente aplica marca d'água, gera thumbnails, extrai metadados EXIF e disponibiliza as imagens para o cliente visualizar e adquirir. O download da versão original sem marca d'água é protegido por URLs assinadas com tempo de expiração.

### Fluxo principal

```
Upload → Salvar original → Aplicar marca d'água → Gerar thumbnail
       → Extrair EXIF (MongoDB) → Marcar como READY → Disponibilizar para cliente
```

---

## Arquitetura

O projeto segue uma arquitetura de microsserviços leves, todos orquestrados via Docker Compose:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│   Nginx      │────▶│  Next.js     │     │   Django API       │
│ (Reverse     │     │  (Frontend)  │────▶│   (Gunicorn/       │
│  Proxy)      │     │  :3000       │     │    Uvicorn) :8000   │
└─────────────┘     └──────────────┘     └────────┬──────────┘
                                                   │
              ┌──────────────────────────────┬──────┘
              │                              │
     ┌────────▼───────┐            ┌─────────▼────────┐
     │   PostgreSQL   │            │      Redis        │
     │   (Dados       │            │  (Cache + Broker  │
     │  relacionais)  │            │   Celery)         │
     └────────────────┘            └─────────┬─────────┘
                                             │
     ┌──────────────────┐          ┌─────────▼────────┐
     │    MongoDB        │          │  Celery Workers  │
     │  (Metadados EXIF  │◀─────────│  (watermark,     │
     │   e audit trail)  │          │  storage,        │
     └──────────────────┘          │  maintenance)    │
                                   └──────────────────┘
     ┌──────────────────┐
     │    MinIO          │
     │  (S3-compatible   │
     │  object storage)  │
     └──────────────────┘
```

O backend adota uma **arquitetura em camadas** dentro do Django:

- **Views** — recebem requisições HTTP, delegam para services/serializers
- **Serializers** — validação, serialização e desserialização de dados
- **Services** — lógica de negócio isolada (watermark, storage, EXIF)
- **Tasks** — processamento assíncrono via Celery
- **Models** — entidades e acesso ao banco de dados

---

## Stack Tecnológica

### Backend

| Tecnologia | Versão | Função |
|---|---|---|
| Python | 3.12 | Linguagem principal |
| Django | 5.1 | Framework web |
| Django REST Framework | 3.15 | API REST |
| Celery | 5.4 | Processamento assíncrono |
| django-celery-beat | 2.7 | Tarefas periódicas agendadas |
| PostgreSQL | 16 | Banco de dados relacional principal |
| MongoDB | 7 | Metadados EXIF e audit trail |
| Redis | 7 | Cache e broker do Celery |
| MinIO | latest | Object storage S3-compatible (dev) / AWS S3 (prod) |
| Pillow | 11.0 | Processamento de imagens e marca d'água |
| drf-spectacular | 0.27 | Geração de documentação OpenAPI 3 |
| SimpleJWT | 5.3 | Autenticação JWT |
| Sentry | 2.19 | Monitoramento de erros em produção |
| django-prometheus | 2.3 | Métricas de observabilidade |
| Gunicorn + Uvicorn | — | Servidores WSGI/ASGI |

### Frontend

| Tecnologia | Versão | Função |
|---|---|---|
| Next.js | 15 | Framework React (App Router) |
| React | 19 | UI |
| TypeScript | 5.5 | Tipagem estática |
| Tailwind CSS | 3.4 | Estilização |
| Zustand | 4.5 | Gerenciamento de estado global |
| React Hook Form + Zod | — | Formulários e validação |
| Framer Motion | 11 | Animações |
| Radix UI | — | Componentes de UI acessíveis |
| Axios | 1.7 | Cliente HTTP |
| react-window | 1.8 | Virtualização de listas |
| Swiper | 11 | Lightbox/carrossel de fotos |

### Infraestrutura / DevOps

| Tecnologia | Função |
|---|---|
| Docker + Docker Compose | Containerização e orquestração local |
| Nginx | Reverse proxy, servir estáticos |
| GitHub Actions | CI/CD (lint, testes, build, deploy) |
| GitHub Container Registry | Registry de imagens Docker |
| Flower | Monitoramento de tarefas Celery |

---

## Estrutura do Projeto

```
FunImage/
├── backend/
│   ├── apps/
│   │   ├── core/               # Abstrações base: modelos, exceções, paginação, middleware
│   │   │   ├── models.py       # BaseModel (UUID + timestamps + soft delete)
│   │   │   ├── exceptions.py   # Handler global de erros com envelope padronizado
│   │   │   ├── middleware.py   # RequestID + logging de requisições
│   │   │   ├── pagination.py   # Paginação padrão
│   │   │   ├── permissions.py  # IsAdmin, IsClient
│   │   │   ├── renderers.py    # SuccessRenderer (envelope JSON uniforme)
│   │   │   ├── mongo.py        # Client MongoDB (pymongo)
│   │   │   └── management/
│   │   │       └── commands/
│   │   │           └── create_periodic_tasks.py  # Registra tarefas do Celery Beat
│   │   ├── authentication/     # Login, logout, refresh token (JWT)
│   │   ├── users/              # CRUD de usuários, roles (admin/client)
│   │   ├── galleries/          # Galerias de fotos por cliente
│   │   ├── dashboard/          # Estatísticas por role (admin e client)
│   │   ├── notifications/      # Notificações in-app por usuário
│   │   └── photos/
│   │       ├── models.py       # Photo, PhotoFavorite, PhotoStatus
│   │       ├── views.py        # Upload, listagem, download, favoritos, compra
│   │       ├── tasks.py        # Pipeline Celery: watermark → EXIF → READY
│   │       └── services/
│   │           ├── watermark.py  # Aplicação de marca d'água (Pillow)
│   │           ├── storage.py    # Abstração S3/local FS
│   │           └── exif.py       # Extração de metadados EXIF
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py         # Configurações compartilhadas
│   │   │   ├── development.py  # Overrides de desenvolvimento
│   │   │   └── production.py   # Overrides de produção
│   │   ├── celery.py           # Configuração do Celery
│   │   └── urls.py             # Roteamento raiz + Swagger
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/
│   ├── public/
│   │   ├── manifest.json       # Web App Manifest (PWA)
│   │   ├── sw.js               # Service Worker (cache + offline)
│   │   └── icons/              # Ícones PWA (32, 96, 192, 512px)
│   ├── src/
│   │   ├── app/                # App Router do Next.js
│   │   │   ├── auth/login/     # Tela de login
│   │   │   ├── gallery/
│   │   │   │   └── shared/[token]/  # Visualização pública de galeria compartilhada
│   │   │   ├── offline/        # Página de fallback offline (PWA)
│   │   │   └── dashboard/
│   │   │       ├── clients/    # Gestão de clientes (admin)
│   │   │       ├── galleries/  # Listagem de galerias
│   │   │       ├── gallery/[id]/ # Galeria individual
│   │   │       ├── upload/     # Upload de fotos
│   │   │       ├── favorites/  # Fotos favoritadas
│   │   │       └── settings/   # Configurações do perfil
│   │   ├── components/
│   │   │   ├── gallery/        # GalleryCard, PhotoGrid, PhotoLightbox, UploadDropzone
│   │   │   ├── layout/         # Sidebar, TopBar, NotificationBell
│   │   │   ├── pwa/            # ServiceWorkerRegistration
│   │   │   └── ui/             # ConfirmDialog, ErrorBoundary, SkeletonCard, PurchaseDialog
│   │   ├── lib/
│   │   │   ├── api.ts          # Cliente Axios + interceptors JWT
│   │   │   └── utils.ts        # Utilitários gerais
│   │   ├── store/              # Zustand stores (auth, gallery, favorites, theme)
│   │   └── types/              # Types e interfaces TypeScript
│   ├── Dockerfile
│   └── package.json
└── docker/
    ├── docker-compose.yml
    ├── nginx/                  # Configurações do Nginx
    ├── postgres/               # Script de inicialização do PostgreSQL
    └── mongo/                  # Script de inicialização do MongoDB
```

---

## Funcionalidades

### Para Admins (fotógrafos)
- Cadastro e gerenciamento de clientes
- Criação de galerias e associação a clientes
- Upload múltiplo de fotos (multipart) com validação de tipo e tamanho
- Aplicação automática de marca d'água configurável
- Geração automática de thumbnails
- Extração e armazenamento de metadados EXIF no MongoDB
- Reprocessamento automático de fotos com falha
- Compartilhamento de galeria via share token (link público)
- Revogação de compartilhamento (gera novo token e torna galeria privada)
- Download de álbum completo (ZIP com fotos adquiridas)
- Monitoramento das filas via Flower
- Dashboard com estatísticas de fotos, galerias, downloads e favoritos
- Notificações in-app quando clientes baixam fotos ou álbuns

### Para Clientes
- Visualização das próprias galerias
- Lightbox com navegação por teclado e swipe
- Favoritar fotos
- Desbloqueio de fotos individuais para download via código de acesso
- Desbloqueio de álbum inteiro para download via código de acesso
- Download de foto original via URL assinada (válida por 1 hora)
- Download de álbum completo em ZIP (apenas fotos adquiridas)
- Acesso público a galerias via share token (sem autenticação)
- Dashboard com estatísticas de fotos disponíveis, álbuns, favoritos e downloads
- Notificações in-app quando o fotógrafo faz upload, processa fotos ou cria álbuns

### Plataforma
- Autenticação JWT com refresh token rotativo e blacklist
- Rate limiting por endpoint (anônimo: 20/min, usuário: 200/min)
- Soft delete em todos os recursos
- Paginação padronizada
- Documentação OpenAPI 3 (Swagger UI + ReDoc)
- Métricas Prometheus
- Rastreamento de erros via Sentry
- Request ID propagado em todos os logs
- Notificações in-app com contador de não lidas em tempo real
- Suporte a PWA: instalável, cache offline e página de fallback

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2+
- Git

Para desenvolvimento local sem Docker:
- Python 3.12+
- Node.js 20+
- PostgreSQL 16, MongoDB 7, Redis 7 rodando localmente

---

## Como Rodar

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/funimage.git
cd funimage
```

### 2. Configure as variáveis de ambiente

```bash
# O arquivo já existe com valores de desenvolvimento prontos
# Revise e ajuste se necessário
cat docker/docker-compose.yml  # variáveis estão declaradas no compose
```

Para personalizar, copie e edite o `.env` do backend:

```bash
cp backend/.env backend/.env.local
# edite conforme necessário
```

### 3. Suba todos os serviços

```bash
cd docker
docker compose up --build
```

### 4. Criação dos usuários demo
Faça isso com o contêiner docker ativo ou com o backend ativo localmente.

```bash
docker compose exec api python manage.py shell -c "exec(open('scripts/seed_dev.py').read())"
```


Na primeira execução, o Docker irá:
- Construir as imagens do backend e frontend
- Inicializar o banco PostgreSQL com as migrations
- Criar o banco MongoDB com os índices necessários
- Criar o bucket no MinIO
- Registrar as tarefas periódicas do Celery Beat

### 4. Acesse a aplicação

| Serviço | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| API Django | http://localhost:8000/api/ |
| Swagger UI | http://localhost:8000/api/docs/ |
| ReDoc | http://localhost:8000/api/redoc/ |
| Django Admin | http://localhost:8000/admin/ |
| Flower (Celery) | http://localhost:5555 (admin / flowerpass) |
| MinIO Console | http://localhost:9001 (minioadmin / minioadmin) |

### 5. Criar superusuário (admin)

```bash
docker compose exec api python manage.py createsuperuser
```

### Rodando apenas o backend localmente (sem Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure as variáveis de ambiente (PostgreSQL, Redis e MongoDB devem estar rodando)
export DJANGO_SETTINGS_MODULE=config.settings
export DJANGO_ENV=development
# ... demais variáveis do .env

python manage.py migrate
python manage.py runserver
```

Em outro terminal, inicie o worker Celery:

```bash
celery -A config.celery worker --loglevel=info --queues=watermark,storage,maintenance,celery
```

### Rodando apenas o frontend localmente

```bash
cd frontend
npm install
cp .env.local.example .env.local  # ajuste a URL da API se necessário
npm run dev
```

---

## Variáveis de Ambiente

### Backend

| Variável | Padrão (dev) | Descrição |
|---|---|---|
| `DJANGO_ENV` | `development` | Ambiente (`development`, `production`, `test`) |
| `SECRET_KEY` | — | Chave secreta do Django (obrigatório em prod) |
| `POSTGRES_HOST` | `postgres` | Host do PostgreSQL |
| `POSTGRES_DB` | `fotopro` | Nome do banco |
| `POSTGRES_USER` | `fotopro` | Usuário do banco |
| `POSTGRES_PASSWORD` | — | Senha do banco |
| `MONGO_URI` | `mongodb://mongo:27017` | URI de conexão MongoDB |
| `MONGO_DB_NAME` | `fotopro_meta` | Nome do banco MongoDB |
| `REDIS_URL` | `redis://redis:6379/0` | URL do Redis |
| `USE_S3` | `False` | Habilita armazenamento S3/MinIO |
| `AWS_ACCESS_KEY_ID` | `minioadmin` | Access key S3/MinIO |
| `AWS_SECRET_ACCESS_KEY` | `minioadmin` | Secret key S3/MinIO |
| `AWS_STORAGE_BUCKET_NAME` | `fotopro-media` | Nome do bucket |
| `AWS_S3_ENDPOINT_URL` | `http://minio:9000` | Endpoint MinIO (dev) |
| `WATERMARK_TEXT` | `© FotoPro` | Texto da marca d'água |
| `WATERMARK_OPACITY` | `0.35` | Opacidade da marca d'água (0.0–1.0) |
| `WATERMARK_FONT_SCALE` | `0.05` | Escala da fonte da marca d'água relativa à largura da imagem |
| `MAX_UPLOAD_SIZE_MB` | `50` | Tamanho máximo de upload |
| `DOWNLOAD_TOKEN_SECRET` | — | Secret para assinar URLs de download |
| `DOWNLOAD_TOKEN_MAX_AGE` | `3600` | TTL das URLs assinadas (segundos) |
| `PURCHASE_ACCESS_CODE` | `121212` | Código de acesso para desbloquear fotos/álbuns para download |
| `FRONTEND_URL` | `http://localhost:3000` | URL base do frontend (usada para montar links de compartilhamento) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Origins permitidas pelo CORS |

### Frontend

| Variável | Padrão | Descrição |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | URL base da API |

---

## API Reference

A documentação interativa completa está disponível em `/api/docs/` (Swagger UI) ou `/api/redoc/` quando o servidor estiver rodando.

### Endpoints principais

```
POST   /api/auth/login/           Autenticação — retorna access + refresh token
POST   /api/auth/logout/          Invalida o refresh token (blacklist)
POST   /api/auth/token/refresh/   Renova o access token

GET    /api/users/                Lista usuários (admin)
POST   /api/users/                Cria usuário (admin)
GET    /api/users/me/             Perfil do usuário autenticado
PATCH  /api/users/me/             Atualiza perfil

GET    /api/galleries/                          Lista galerias do usuário autenticado
POST   /api/galleries/                          Cria galeria (admin)
GET    /api/galleries/{id}/                     Detalhe da galeria
PATCH  /api/galleries/{id}/                     Atualiza galeria (admin)
DELETE /api/galleries/{id}/                     Soft delete da galeria (admin)
POST   /api/galleries/{id}/share/               Torna galeria pública e retorna share URL
POST   /api/galleries/{id}/revoke-share/        Revoga compartilhamento (torna privada + novo token)
GET    /api/galleries/shared/{token}/           Acesso público à galeria via token (sem auth)
GET    /api/galleries/{id}/download/            Download ZIP de todas as fotos adquiridas do álbum
POST   /api/galleries/{id}/purchase/            Desbloqueia todas as fotos do álbum via código de acesso

POST   /api/photos/upload/        Upload de foto(s) — multipart/form-data
GET    /api/photos/               Lista fotos (filtros: gallery, status, is_purchased)
GET    /api/photos/{id}/          Detalhe da foto
DELETE /api/photos/{id}/          Soft delete (admin)
GET    /api/photos/{id}/download/ URL assinada para download do original
POST   /api/photos/{id}/purchase/ Desbloqueia foto individual via código de acesso
POST   /api/photos/{id}/favorite/ Favorita/desfavorita foto
GET    /api/photos/favorites/     Lista fotos favoritadas

GET    /api/dashboard/stats/      Estatísticas escopadas por role (admin ou client)

GET    /api/notifications/                  Lista as últimas 50 notificações do usuário
GET    /api/notifications/unread-count/     Contagem de notificações não lidas (para badge)
POST   /api/notifications/{id}/read/        Marca uma notificação como lida
POST   /api/notifications/read-all/         Marca todas as notificações como lidas

GET    /api/health/               Health check da API
GET    /metrics                   Métricas Prometheus
```

### Formato de resposta

Todas as respostas seguem um envelope padronizado:

```json
// Sucesso
{
  "status": "success",
  "data": { ... }
}

// Lista paginada
{
  "status": "success",
  "data": {
    "count": 100,
    "next": "http://api.../photos/?page=2",
    "previous": null,
    "results": [ ... ]
  }
}

// Erro
{
  "status": "error",
  "code": "validation_error",
  "message": "Dados inválidos.",
  "errors": { "field": ["mensagem de erro"] }
}
```

### Autenticação

```bash
# Obter tokens
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "sua-senha"}'

# Usar o access token nas requisições
curl http://localhost:8000/api/galleries/ \
  -H "Authorization: Bearer <access_token>"
```

### Sistema de Compra / Desbloqueio

Para desbloquear fotos ou álbuns e liberar o download sem marca d'água, o cliente fornece o código de acesso configurado pela variável `PURCHASE_ACCESS_CODE`. O código padrão em desenvolvimento é `121212`.

```bash
# Desbloquear uma foto individual
curl -X POST http://localhost:8000/api/photos/{id}/purchase/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "121212"}'

# Desbloquear todas as fotos de um álbum
curl -X POST http://localhost:8000/api/galleries/{id}/purchase/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "121212"}'

# Baixar álbum em ZIP (após desbloqueio)
curl -OJ http://localhost:8000/api/galleries/{id}/download/ \
  -H "Authorization: Bearer <token>"
```

---

## Pipeline de Processamento de Fotos

Após o upload, cada foto passa pelo seguinte pipeline Celery assíncrono:

```
[HTTP Upload]
      │
      ▼
[Salva original no storage]
      │
      ▼
[process_watermark] ──────── queue: watermark
      │  - Lê bytes do original
      │  - Aplica marca d'água via Pillow (posição: bottom-right ou tiled)
      │  - Gera thumbnail 800×800 (JPEG quality 85)
      │  - Salva variantes no storage
      │  - Atualiza largura/altura no PostgreSQL
      │
      ▼
[extract_exif_metadata] ───── queue: watermark
      │  - Extrai tags EXIF do original
      │  - Persiste no MongoDB (fotopro_meta.photo_metadata)
      │  - Marca foto como READY
      │  - Envia notificação in-app "photo_ready" ao cliente
      │
      ▼
[Status: READY — disponível para o cliente]
```

**Resiliência:**
- Cada task tem até 3 tentativas automáticas com backoff
- Fotos travadas em `PROCESSING` por mais de 15 minutos são automaticamente reenfileiradas
- Fotos em estado `ERROR` por mais de 24 horas são removidas por tarefa periódica
- Falha na extração de EXIF não bloqueia a foto (non-fatal)

**Filas Celery:**

| Fila | Tarefas |
|---|---|
| `watermark` | `process_watermark`, `extract_exif_metadata` |
| `storage` | `upload_to_s3` |
| `maintenance` | `cleanup_temp_files`, `reprocess_failed_photos` |

---

## Modelo de Dados

### PostgreSQL

```
users
  id (UUID PK), email (unique), name, role (admin|client),
  avatar, phone, is_active, created_at, updated_at

galleries
  id (UUID PK), name, description, client_id (FK users),
  created_by_id (FK users), is_public, share_token (unique),
  created_at, updated_at, deleted_at

photos
  id (UUID PK), gallery_id (FK galleries), uploaded_by_id (FK users),
  original_file, watermarked_file, thumbnail_file,
  filename, mime_type, size, width, height,
  status (pending|processing|ready|error), processing_error,
  celery_task_id, is_purchased, sort_order,
  created_at, updated_at, deleted_at

photo_favorites
  user_id (FK users), photo_id (FK photos), created_at
  UNIQUE (user_id, photo_id)

notifications
  id (UUID PK), recipient_id (FK users),
  type (photo_uploaded|photo_ready|album_created|photo_downloaded|album_downloaded),
  title, message, is_read, read_at,
  data (JSONField — contexto livre: gallery_id, photo_id, photo_count, actor_name…),
  created_at, updated_at, deleted_at
```

### MongoDB (fotopro_meta)

```
photo_metadata
  photo_id (string),        # UUID da foto no PostgreSQL
  exif: { ... },            # Tags EXIF extraídas do original
  processing_info: {
    original_filename,
    original_size_bytes,
    watermark_applied_at,
    mime_type
  },
  created_at
```

### Padrão de Modelo Base

Todos os models (exceto `User`) herdam de `BaseModel`, que combina:

- **`UUIDModel`** — Primary key UUID4 (previne ataques de enumeração)
- **`TimeStampedModel`** — `created_at` e `updated_at` automáticos
- **`SoftDeleteModel`** — Soft delete via `deleted_at`; o manager padrão filtra registros deletados automaticamente

---

## Frontend

### Estrutura de páginas (App Router)

```
/auth/login                        Tela de login
/dashboard                         Redirect para /dashboard/dashboard
/dashboard/dashboard               Visão geral (métricas, últimas galerias)
/dashboard/galleries               Listagem de galerias
/dashboard/gallery/[id]            Galeria com PhotoGrid e Lightbox
/dashboard/upload                  Upload de fotos com drag-and-drop
/dashboard/clients                 Gestão de clientes (admin)
/dashboard/favorites               Fotos favoritadas
/dashboard/settings                Configurações do perfil
/gallery/shared/[token]            Visualização pública de galeria (sem login)
/offline                           Página de fallback exibida quando sem conexão (PWA)
```

### Gerenciamento de estado (Zustand)

| Store | Responsabilidade |
|---|---|
| `auth.store` | Token JWT, usuário autenticado, login/logout |
| `gallery.store` | Galerias, fotos, paginação, filtros |
| `favorites.store` | IDs de fotos favoritadas, toggle |
| `theme.store` | Tema claro/escuro persistido no localStorage |

### Componentes principais

- **`UploadDropzone`** — Drag-and-drop com preview, validação de tipo/tamanho e progresso de upload
- **`PhotoGrid`** — Grid virtualizado com `react-window` para performance em grandes coleções
- **`PhotoLightbox`** — Visualizador fullscreen com Swiper, navegação por teclado e ações (favoritar, download)
- **`GalleryCard`** — Card de galeria com cover photo, contagem e ações
- **`Sidebar`** — Navegação responsiva com indicador de rota ativa
- **`NotificationBell`** — Sino de notificações no TopBar com badge de não lidas, dropdown de histórico e ações de marcar como lida
- **`PurchaseDialog`** — Modal de desbloqueio com campo de código de 6 dígitos para liberar download de foto ou álbum inteiro
- **`ErrorBoundary`** — Captura erros de renderização React
- **`ServiceWorkerRegistration`** — Registra o Service Worker silenciosamente após o carregamento da página

---

## PWA (Progressive Web App)

O FunImage é instalável como aplicativo nativo em desktop e mobile.

### Recursos

- **Instalável** — Web App Manifest (`/public/manifest.json`) com ícones de 32px a 512px e modo `standalone`
- **Cache offline** — Service Worker (`/public/sw.js`) com estratégias por tipo de conteúdo:

| Tipo de recurso | Estratégia |
|---|---|
| App shell (JS/CSS/fontes) | Cache First |
| Páginas Next.js | Network First com fallback de cache |
| Imagens de fotos (MinIO/S3) | Cache First com limite de 200 entradas e TTL de 7 dias |
| Chamadas de API | Network Only (dados sempre frescos) |
| Download de ZIP | Network Only (nunca cacheado) |

- **Página offline** — Ao acessar uma rota não cacheada sem conexão, o usuário é redirecionado para `/offline` com opção de recarregar
- **Atualização automática** — O Service Worker detecta novas versões e aplica `skipWaiting()` no install

### Configuração

O registro do Service Worker é feito pelo componente `<ServiceWorkerRegistration />` incluído no layout raiz. Ele se registra somente após o evento `load` para não impactar o LCP.

---

## Sistema de Notificações In-App

As notificações informam admins e clientes sobre eventos relevantes na plataforma.

### Tipos de notificação

| Tipo | Destinatário | Disparado quando |
|---|---|---|
| `photo_uploaded` | Cliente | Admin faz upload de fotos numa galeria do cliente |
| `photo_ready` | Cliente | Fotos concluem o pipeline de processamento (READY) |
| `album_created` | Cliente | Admin cria uma nova galeria para o cliente |
| `photo_downloaded` | Admin | Cliente baixa uma foto original |
| `album_downloaded` | Admin (todos) | Cliente baixa um álbum completo em ZIP |

### Funcionamento

- Todas as notificações são criadas via `notify()` em `apps/notifications/utils.py`, que captura silenciosamente eventuais falhas para não interromper a requisição principal
- Admins recebem notificações de atividade de clientes via `notify_all_admins()`
- O frontend consulta `/api/notifications/unread-count/` em polling leve para atualizar o badge no sino
- A lista completa é carregada apenas quando o dropdown é aberto
- O campo `data` (JSON livre) traz IDs de contexto (`gallery_id`, `photo_id`, `photo_count`, `actor_name`) para o frontend construir deep links

---

## Testes

### Backend

O projeto usa **pytest** com **pytest-django**.

```bash
cd backend

# Rodar todos os testes
pytest

# Com cobertura
pytest --cov=apps --cov-report=term-missing

# Rodar suite específica
pytest apps/photos/tests/
pytest apps/galleries/tests/
pytest apps/authentication/tests/
```

**Ferramentas de teste:**
- `factory-boy` — Factories para criação de dados de teste
- `faker` — Geração de dados falsos
- `freezegun` — Controle do tempo nos testes
- `moto[s3]` — Mock do AWS S3 nos testes de storage
- `pytest-asyncio` — Suporte a testes assíncronos
- Cobertura mínima exigida pela CI: **75%**

### Exemplo de execução

```bash
# Configurar variáveis para teste local
export DJANGO_ENV=test
export USE_S3=False
export POSTGRES_DB=fotopro_test
# ... demais variáveis

pytest -v --tb=short
```

---

## CI/CD

O pipeline GitHub Actions (`.github/workflows/ci.yml`) executa automaticamente em push para `main`/`develop` e PRs para `main`:

### Etapas

```
1. lint        Ruff (linter), Black (formatter), isort (imports)
2. test        pytest com PostgreSQL + Redis + MongoDB reais (services do GHA)
               Coverage mínima: 75%  |  Upload para Codecov
3. build       Build da imagem Docker (apenas branch main)
               Push para GitHub Container Registry (ghcr.io)
4. deploy      Deploy via SSH para servidor de produção (apenas branch main)
               docker compose pull → up → migrate → collectstatic
```

### Ferramentas de qualidade de código

| Ferramenta | Função |
|---|---|
| `ruff` | Linter Python (substitui flake8 + pylint) |
| `black` | Formatter Python (opinionated) |
| `isort` | Ordenação de imports |
| `mypy` + django-stubs | Type checking estático |

---

## Convenções e Padrões de Código

### Python / Django

**Nomenclatura:**
- Classes: `PascalCase`
- Funções, variáveis e métodos: `snake_case`
- Constantes: `UPPER_SNAKE_CASE`
- Apps Django: nomes curtos em minúsculo (`photos`, `galleries`)

**Models:**
- Todos os models herdam de `BaseModel` (UUID PK + timestamps + soft delete)
- Campos com `db_index=True` em colunas usadas em filtros frequentes
- `Meta.db_table` sempre definido explicitamente (sem prefixo de app)
- Comentários de seção com `# ── Nome da seção ─────`

**Views:**
- ViewSets DRF com ações nomeadas (`@action`)
- Permissões declaradas na classe (`permission_classes`)
- Lógica de negócio delegada para services, nunca inline na view

**Serializers:**
- Validações de campo em métodos `validate_<field>`
- Validações cruzadas em `validate(self, attrs)`
- `read_only_fields` sempre explícito

**Exceções:**
- Usar `BusinessException` para violações de regra de negócio (HTTP 422)
- Usar `ResourceNotFoundException` para 404 tipado
- O handler global formata todas as exceções no envelope padrão

**Tarefas Celery:**
- Todas as tasks têm `bind=True`, `autoretry_for` e `retry_kwargs`
- Tasks são idempotentes (verificam estado antes de processar)
- Imports dentro da função para evitar problemas de inicialização circular

**Notificações:**
- Toda criação passa por `notify()` ou `notify_all_admins()` em `apps/notifications/utils.py`
- Nunca importar o model `Notification` diretamente em views ou tasks — sempre usar as funções utilitárias
- Falhas de notificação são logadas como `warning` e nunca propagadas

**Settings:**
- Separados por ambiente (`base.py`, `development.py`, `production.py`)
- Nenhum segredo hardcoded — tudo via `os.environ.get()`
- Seções separadas por comentários de divisão horizontal

### TypeScript / Next.js

**Nomenclatura:**
- Componentes: `PascalCase`
- Hooks, funções e variáveis: `camelCase`
- Types e interfaces: `PascalCase`
- Arquivos de componente: `PascalCase.tsx`
- Arquivos de store/lib/utils: `camelCase.ts`

**Componentes:**
- Sempre com tipagem explícita de props
- Componentes de UI reutilizáveis em `src/components/ui/`
- Lógica de negócio separada dos componentes de apresentação

**Estado:**
- Estado local com `useState`/`useReducer` quando possível
- Estado global (autenticação, dados compartilhados) via Zustand
- Sem prop drilling além de 2 níveis — usar store

**API:**
- Todas as chamadas centralizadas em `src/lib/api.ts`
- Interceptor Axios para injeção automática do token JWT
- Interceptor de resposta para refresh automático do token

---

## Serviços e Portas

| Serviço | Porta | Acesso |
|---|---|---|
| Nginx (proxy principal) | 80 | http://localhost |
| Frontend Next.js | 3000 | http://localhost:3000 |
| Django API | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | localhost:5432 |
| MongoDB | 27017 | localhost:27017 |
| Redis | 6379 | localhost:6379 |
| MinIO S3 API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |
| Flower (Celery UI) | 5555 | http://localhost:5555 |

---

## Licença

Proprietária. Todos os direitos reservados.
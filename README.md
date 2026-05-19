# FunImage Case

Plataforma de gerenciamento de fotos com backend Django e frontend Next.js.

## Estrutura do Projeto

```
FunImage-Case/
├── backend/      # API Django (DRF) + Celery
├── frontend/     # Interface Next.js
├── docker/       # Docker Compose e configs de serviços
└── README.md
```

## Como rodar

```bash
cd docker
docker compose up --build
```

## Serviços

| Serviço        | Porta  |
|----------------|--------|
| Frontend       | 3000   |
| Django API     | 8000   |
| Nginx          | 80     |
| PostgreSQL     | 5432   |
| MongoDB        | 27017  |
| Redis          | 6379   |
| MinIO API      | 9000   |
| MinIO Console  | 9001   |
| Flower         | 5555   |

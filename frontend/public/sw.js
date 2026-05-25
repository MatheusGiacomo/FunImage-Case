/**
 * FotoPro Service Worker
 * Estratégia:
 *  - App shell (JS/CSS/fontes) → Cache First
 *  - Páginas Next.js → Network First com fallback offline
 *  - Imagens de fotos (minio/S3) → Cache First com limite de tamanho
 *  - API calls → Network Only (dados sempre frescos)
 *  - Download de ZIP → Network Only (nunca cacheia)
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE   = `fotopro-shell-${CACHE_VERSION}`;
const PAGES_CACHE   = `fotopro-pages-${CACHE_VERSION}`;
const IMAGES_CACHE  = `fotopro-images-${CACHE_VERSION}`;

const MAX_IMAGE_CACHE_ENTRIES = 200;  // máx de fotos em cache
const MAX_IMAGE_CACHE_AGE_MS  = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Recursos do app shell — cacheados no install
const SHELL_URLS = [
  '/',
  '/dashboard',
  '/dashboard/galleries',
  '/dashboard/favorites',
  '/offline',
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch((err) => {
        // Não falha o install se alguma página não existir ainda
        console.warn('[SW] Shell pre-cache parcial:', err);
      })
    ).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) =>
            key.startsWith('fotopro-') &&
            ![SHELL_CACHE, PAGES_CACHE, IMAGES_CACHE].includes(key)
          )
          .map((key) => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-GET e chrome-extension
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // ── Downloads de ZIP — nunca cacheia ──────────────────────────────────────
  if (url.pathname.includes('/download/') && !url.pathname.includes('/photos/')) {
    return; // passa direto para a rede
  }

  // ── API calls — Network Only ───────────────────────────────────────────────
  if (url.hostname === location.hostname && url.pathname.startsWith('/api/')) {
    return; // sempre da rede
  }

  // ── Imagens de fotos (MinIO / S3 / media) — Cache First ───────────────────
  if (isPhotoImage(url)) {
    event.respondWith(cacheFirstWithExpiry(request, IMAGES_CACHE));
    return;
  }

  // ── Recursos estáticos Next.js (_next/static) — Cache First ───────────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // ── Páginas do app — Network First com fallback ────────────────────────────
  if (url.hostname === location.hostname) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // ── Demais recursos externos (fonts, CDN) — Cache First ───────────────────
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// ─── Estratégias ──────────────────────────────────────────────────────────────

/** Cache First: retorna cache imediatamente; se não existir, busca na rede e salva */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso indisponível offline.', { status: 503 });
  }
}

/** Cache First com verificação de validade por timestamp */
async function cacheFirstWithExpiry(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const dateHeader = cached.headers.get('sw-cached-at');
    if (dateHeader) {
      const age = Date.now() - parseInt(dateHeader, 10);
      if (age < MAX_IMAGE_CACHE_AGE_MS) return cached;
    } else {
      return cached; // sem header de data, confia no cache
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Injeta header com timestamp de quando foi cacheado
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const responseToCache = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      await cache.put(request, responseToCache);
      await trimCache(cache, MAX_IMAGE_CACHE_ENTRIES);
    }
    return response;
  } catch {
    if (cached) return cached; // offline: retorna versão expirada do cache
    return new Response('Imagem indisponível offline.', { status: 503 });
  }
}

/** Network First: tenta rede; se falhar, usa cache; se não tiver cache, mostra offline */
async function networkFirstWithFallback(request) {
  const cache = await caches.open(PAGES_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Fallback: tenta retornar a página offline
    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;

    return new Response(offlineFallbackHTML(), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPhotoImage(url) {
  // MinIO / S3 interno
  if (url.hostname.includes('minio') || url.hostname.includes('localhost') && url.port === '9000') return true;
  // Arquivos de imagem em /media/
  if (url.pathname.startsWith('/media/')) return true;
  // S3 / CloudFront
  if (url.hostname.includes('.amazonaws.com') || url.hostname.includes('cloudfront.net')) return true;
  return false;
}

/** Remove entradas mais antigas quando o cache passa do limite */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

function offlineFallbackHTML() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FotoPro — Offline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0f0f10;
      color: #e5e5e5;
      font-family: system-ui, sans-serif;
      text-align: center;
      padding: 2rem;
      gap: 1rem;
    }
    .logo {
      width: 56px; height: 56px;
      border-radius: 14px;
      background: rgba(212,175,55,0.15);
      border: 1px solid rgba(212,175,55,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: 700; color: #d4af37;
      margin-bottom: 0.5rem;
    }
    h1 { font-size: 1.5rem; font-weight: 300; color: #f5f5f5; }
    p  { font-size: 0.875rem; color: #666; max-width: 320px; line-height: 1.6; }
    button {
      margin-top: 0.5rem;
      padding: 0.625rem 1.5rem;
      border-radius: 10px;
      border: 1px solid rgba(212,175,55,0.4);
      background: rgba(212,175,55,0.1);
      color: #d4af37;
      font-size: 0.875rem;
      cursor: pointer;
    }
    button:hover { background: rgba(212,175,55,0.2); }
  </style>
</head>
<body>
  <div class="logo">F</div>
  <h1>Você está offline</h1>
  <p>Verifique sua conexão com a internet e tente novamente.</p>
  <button onclick="location.reload()">Tentar novamente</button>
</body>
</html>`;
}
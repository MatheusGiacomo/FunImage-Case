'use client';

import { useEffect } from 'react';

/**
 * Hook que registra o Service Worker do FotoPro.
 * Use no layout raiz: <ServiceWorkerRegistration />
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Nova versão disponível — pode mostrar um toast se quiser
              console.log('[SW] Nova versão disponível.');
            }
          });
        });

        console.log('[SW] Registrado com sucesso:', registration.scope);
      } catch (err) {
        console.warn('[SW] Falha ao registrar:', err);
      }
    };

    // Registra após o load para não bloquear o LCP
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
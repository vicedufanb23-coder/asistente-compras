'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Solo registrar en producción (en dev el SW cachea cosas en desarrollo)
    if (process.env.NODE_ENV !== 'production') return;

    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) =>
          console.warn('No se pudo registrar el service worker:', err)
        );
    };

    // Esperar a que la página esté lista para evitar competencia por el precache
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
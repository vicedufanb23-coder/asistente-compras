// ==========================================
// SERVICE WORKER — CALCULANDO TODO + Recordatorios Hablados
// Estrategia offline-first con alertas en segundo plano
// ==========================================

const CACHE_VERSION = 'calculando-todo-v1';

// Rutas del shell de la app (prerenderizadas estáticas)
const PRECACHE_URLS = [
  '/',
  '/verduras',
  '/supermercado',
  '/actividades',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// Cache para datos de recordatorios (se mantiene aunque cierre la app)
const REMINDER_CACHE = 'recordatorios-cache-v1';

// Configuración de recordatorios
const UMbral_MINUTOS_ANTICIPO = 10; // Avísale 10 min antes
const UMbral_MINUTOS_POSTERIO = 2;   // Y 2 min después si está exacta
const INTERVALO_VERIFICACION = 60000; // Cada 1 minuto en segundo plano

let actividades = [];
let intervalId = null;

// ==========================================
// INSTALACIÓN: precachear shell + inicializar recordatorios
// ==========================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ==========================================
// ACTIVACIÓN: limpiar cachés viejas + tomar control
// ==========================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION && key !== REMINDER_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ==========================================
// ESCUCHADOR: recibir actividades desde la página
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_ACTIVIDADES') {
    actividades = event.data.actividades || [];
    // Guardar en cache para persistir aunque cierre la app
    caches.open(REMINDER_CACHE).then((cache) => {
      cache.put('actividades', new Blob([JSON.stringify(actividades)], { type: 'application/json' }));
    });
    // Reiniciar verificación si el worker no estaba corriendo
    if (!intervalId) {
      iniciarVerificacionRecordatorios();
    }
  }
});

// ==========================================
// SINCRONIZAR DESDE LOCALSTORAGE DE LA PÁGINA
// Cuando la página carga, le envía los datos al SW
// ==========================================
self.clients.claim();

// Función para que la página envíe actividades al SW
export function sincronizarActividadesConSW(actividadesData) {
  const client = clients.getAll().then(clients => {
    const messageClient = clients.find(c => c.type === 'window');
    if (messageClient) {
      messageClient.postMessage({
        type: 'UPDATE_ACTIVIDADES',
        actividad: actividadesData,
      });
    }
  });
}

// ==========================================
// INICIAR VERIFICACIÓN DE RECORDATORIOS EN SEGUNDO PLANO
// ==========================================
function iniciarVerificacionRecordatorios() {
  if (intervalId) clearInterval(intervalId);

  // Verificar inmediatamente
  verificarRecordatorios();

  // Luego cada minuto
  intervalId = setInterval(verificarRecordatorios, INTERVALO_VERIFICACION);
}

// ==========================================
// VERIFICAR RECORDATORIOS Y LANZAR ALERTAS
// ==========================================
function verificarRecordatorios() {
  const ahora = new Date();
  const horaActual = ahora.getHours().toString().padStart(2, '0');
  const minutosActual = ahora.getMinutes().toString().padStart(2, '0');
  const fechaActual = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
  const minutosActualesNum = ahora.getMinutes();

  for (const actividad of actividades) {
    // Solo actividades no completadas con recordatorio activado
    if (actividad.completada || !actividad.recordatorio_activado) continue;

    // Verificar si la fecha coincide
    if (actividad.fecha !== fechaActual) continue;

    // Verificar si la hora está dentro de la ventana de alerta
    const [horaAct, minAct] = actividad.hora.split(':');
    const horaActNum = parseInt(horaAct, 10);
    const minActNum = parseInt(minAct, 10);
    const minutosActualesTotales = horaActual * 60 + minutosActualesNum;
    const minutosActProgramados = horaActNum * 60 + minActNum;

    // Calcular diferencia en minutos (positivo = falta, negativo = ya pasó)
    const diferencia = minutosActProgramados - minutosActualesTotales;

    // Avisar si falta entre 1 y 10 minutos, o si ya pasó entre 0 y 2 minutos
    const debeAvisar =
      (diferencia >= 1 && diferencia <= UMbral_MINUTOS_ANTICIPO) ||
      (diferencia >= -UMbral_MINUTOS_POSTERIO && diferencia <= 0);

    if (debeAvisar) {
      // Lanzar notificación nativa en segundo plano
      lanzarNotificacion(actividad);
    }
  }
}

// ==========================================
// LANZAR NOTIFICACIÓN NATIVA EN SEGUNDO PLANO
// ==========================================
function lanzarNotificacion(actividad) {
  // Verificar si el usuario ya tiene permiso
  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
      const titulo = `⏰ Recordatorio: ${actividad.titulo}`;
      const options = {
        body: actividad.titulo,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: actividad.id,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        // Prioridad alta para que se muestre aunque esté en segundo plano
        priority: 'high',
      };

      try {
        const notification = new Notification(titulo, options);

        // Auto-cerrar después de 10 minutos si el usuario no interactúa
        setTimeout(() => {
          notification.close();
        }, 10 * 60 * 1000);
      } catch (error) {
        console.error('Error mostrando notificación:', error);
      }
    }
  });
}

// ==========================================
// INTERCEPTAR FETCH PARA ASSETS (ya existente)
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET
  if (request.method !== 'GET') return;

  // Navegación: network-first, fallback a caché
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) =>
            cache.put(request, copy)
          );
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Assets estáticos: cache-first + rellenar caché
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) =>
            cache.put(request, copy)
          );
        }
        return response;
      });
    })
  );
});
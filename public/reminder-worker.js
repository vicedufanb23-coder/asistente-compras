// ==========================================
// REMINDER WEB WORKER
// Monitorea actividades y envía alertas al hilo principal
// Se ejecuta en un hilo separado del CPU
// ==========================================

let actividades = [];
let intervalId = null;

/**
 * Recibe mensajes del hilo principal
 */
self.onmessage = function (event) {
  const { type, data } = event.data;

  switch (type) {
    case 'UPDATE_ACTIVIDADES':
      actividades = data || [];
      break;

    case 'START':
      if (!intervalId) {
        intervalId = setInterval(verificarRecordatorios, 30000); // Cada 30 segundos
        // También verificar inmediatamente
        verificarRecordatorios();
      }
      break;

    case 'STOP':
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      break;

    default:
      break;
  }
};

/**
 * Verifica si alguna actividad necesita lanzar un recordatorio
 */
function verificarRecordatorios() {
  const ahora = new Date();
  const horaActual = ahora.getHours().toString().padStart(2, '0');
  const minutosActual = ahora.getMinutes().toString().padStart(2, '0');
  const fechaActual = ahora.toISOString().split('T')[0]; // YYYY-MM-DD

  for (const actividad of actividades) {
    // Solo actividades no completadas con recordatorio activado
    if (actividad.completada || !actividad.recordatorio_activado) continue;

    // Verificar si la fecha coincide
    if (actividad.fecha !== fechaActual) continue;

    // Verificar si la hora coincide (margen de 1 minuto)
    const [horaAct, minAct] = actividad.hora.split(':');

    if (horaAct === horaActual && minAct === minutosActual) {
      // Enviar alerta al hilo principal
      self.postMessage({
        type: 'RECORDATORIO',
        actividad: {
          id: actividad.id,
          titulo: actividad.titulo,
          descripcion: actividad.descripcion,
          hora: actividad.hora,
        },
      });
    }
  }
}

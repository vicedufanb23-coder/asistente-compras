// ==========================================
// REMINDER WEB WORKER
// Monitorea actividades y envía alertas al hilo principal
// Se ejecuta en un hilo separado del CPU
// ==========================================

let actividades = [];
let intervalId = null;

/**
 * CONFIGURACIÓN
 */
const UMbral_MINUTOS_ANTICIPO = 10; // Ahora avisa 10 minutos antes
const UMbral_MINUTOS_POSTERIO = 2;   // Y 2 minutos después (por si está exacta la hora)
const INTERVALO_VERIFICACION = 20000; // Cada 20 segundos

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
        intervalId = setInterval(verificarRecordatorios, INTERVALO_VERIFICACION);
        // Verificar inmediatamente al iniciar
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
 * - Avisa UMbral_MINUTOS_ANTICIPO minutos antes de la hora
 * - También avisa si ya pasó la hora (hasta UMbral_MINUTOS_POSTERIO minutos)
 * - Envía mensaje al hilo principal; la deduplicación la maneja la página
 */
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

    // Avisar si falta entre 1 y UMbral_MINUTOS_ANTICIPO minutos,
    // O si ya pasó entre 0 y UMbral_MINUTOS_POSTERIO minutos
    const debeAvisar = 
      (diferencia >= 1 && diferencia <= UMbral_MINUTOS_ANTICIPO) ||
      (diferencia >= -UMbral_MINUTOS_POSTERIO && diferencia <= 0);

    if (debeAvisar) {
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
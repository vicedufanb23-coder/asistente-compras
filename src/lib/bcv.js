import { guardarLocal, leerLocal } from './storage';

const CACHE_KEY = 'tasa_bcv';
const API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const TIMEOUT_MS = 3000; // 3 segundos máximo de espera

/**
 * Obtiene la tasa BCV del dólar.
 * Estrategia: NetworkFirst con timeout → Fallback a caché local.
 * 
 * @returns {Promise<{tasa: number, fuente: string, fecha: string}>}
 */
export async function obtenerTasaBCV() {
  // Intentar obtener de la red con timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(API_URL, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const resultado = {
      tasa: parseFloat(data.promedio || data.precio || 0),
      fuente: 'dolarapi.com (en vivo)',
      fecha: new Date().toISOString(),
      moneda: data.moneda || 'USD',
    };

    // Guardar en caché local para uso offline
    guardarLocal(CACHE_KEY, resultado);

    return resultado;
  } catch (error) {
    console.warn('⚠️ No se pudo obtener tasa BCV en línea:', error.message);

    // Fallback: leer del caché local
    const cache = leerLocal(CACHE_KEY);

    if (cache) {
      return {
        ...cache,
        fuente: `caché local (${formatearFecha(cache.fecha)})`,
      };
    }

    // Tasa de emergencia si nunca se cacheó
    return {
      tasa: 0,
      fuente: 'no disponible',
      fecha: null,
      moneda: 'USD',
    };
  }
}

/**
 * Convierte de USD a VES usando la tasa BCV
 */
export function convertirUsdAVes(montoUsd, tasaBcv) {
  return parseFloat((montoUsd * tasaBcv).toFixed(2));
}

/**
 * Convierte de VES a USD usando la tasa BCV
 */
export function convertirVesAUsd(montoVes, tasaBcv) {
  if (tasaBcv === 0) return 0;
  return parseFloat((montoVes / tasaBcv).toFixed(2));
}

/**
 * Formatea una fecha ISO a formato legible
 */
function formatearFecha(fechaISO) {
  if (!fechaISO) return 'desconocida';
  try {
    return new Date(fechaISO).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'desconocida';
  }
}

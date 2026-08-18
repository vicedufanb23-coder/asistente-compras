import { supabase, isSupabaseConfigured } from './supabase';

// ==========================================
// MOTOR LOCAL-FIRST DE PERSISTENCIA
// ==========================================

/**
 * Guarda datos en LocalStorage (siempre, 0% internet requerido)
 */
export function guardarLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error(`Error guardando en LocalStorage [${key}]:`, e);
    return false;
  }
}

/**
 * Lee datos de LocalStorage
 */
export function leerLocal(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Error leyendo LocalStorage [${key}]:`, e);
    return defaultValue;
  }
}

/**
 * Elimina datos de LocalStorage
 */
export function eliminarLocal(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`Error eliminando LocalStorage [${key}]:`, e);
    return false;
  }
}

/**
 * Genera un ID único para registros locales
 */
export function generarId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================
// SINCRONIZACIÓN CON SUPABASE (OPCIONAL)
// ==========================================

/**
 * Intenta sincronizar un registro a Supabase.
 * Si no hay internet o Supabase no está configurado, falla silenciosamente.
 * El dato YA fue guardado localmente antes de llamar esta función.
 */
export async function sincronizarConNube(tabla, registro) {
  if (!isSupabaseConfigured() || !navigator.onLine) {
    return { sincronizado: false, motivo: 'offline o no configurado' };
  }

  try {
    const { error } = await supabase.from(tabla).upsert([registro], {
      onConflict: 'id',
    });

    if (error) {
      console.warn(`Sync parcial [${tabla}]:`, error.message);
      return { sincronizado: false, motivo: error.message };
    }

    return { sincronizado: true };
  } catch (e) {
    console.warn(`No se pudo sincronizar [${tabla}]:`, e.message);
    return { sincronizado: false, motivo: e.message };
  }
}

/**
 * Intenta sincronizar TODOS los registros de una tabla local a Supabase.
 * Útil para cuando se recupera la conexión.
 */
export async function sincronizarTodoConNube(tabla, keyLocal) {
  if (!isSupabaseConfigured() || !navigator.onLine) return;

  const datos = leerLocal(keyLocal, []);
  if (datos.length === 0) return;

  try {
    const { error } = await supabase.from(tabla).upsert(datos, {
      onConflict: 'id',
    });

    if (!error) {
      console.log(`✅ ${datos.length} registros de [${tabla}] sincronizados`);
    }
  } catch (e) {
    console.warn(`Sincronización masiva fallida [${tabla}]:`, e.message);
  }
}

// ==========================================
// HELPERS DE CONECTIVIDAD
// ==========================================

/**
 * Verifica si hay conexión a internet
 */
export function hayInternet() {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Escucha cambios de conectividad y ejecuta callbacks
 */
export function escucharConectividad(onOnline, onOffline) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

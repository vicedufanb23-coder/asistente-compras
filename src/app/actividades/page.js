'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, ArrowLeft, Bell, BellOff, Check,
  Clock, Calendar, Volume2, ClipboardList
} from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import StatusBar from '@/components/StatusBar';
import { guardarLocal, leerLocal, generarId, sincronizarConNube } from '@/lib/storage';

const STORAGE_KEY = 'actividades_lista';

export default function ActividadesPage() {
  const [items, setItems] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [notificacionesPermitidas, setNotificacionesPermitidas] = useState(false);
  const workerRef = useRef(null);
  const alertasMostradasRef = useRef(new Set());

  // Inicializar Worker y cargar datos
  useEffect(() => {
    const saved = leerLocal(STORAGE_KEY, []);
    setItems(saved);

    // Fecha por defecto: hoy
    const hoy = new Date().toISOString().split('T')[0];
    setFecha(hoy);

    // Pedir permisos de notificación
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        setNotificacionesPermitidas(perm === 'granted');
      });
    } else if (typeof Notification !== 'undefined') {
      setNotificacionesPermitidas(Notification.permission === 'granted');
    }

    // Iniciar Web Worker para recordatorios
    if (typeof window !== 'undefined') {
      const worker = new Worker('/reminder-worker.js');

      worker.onmessage = (event) => {
        const { type, actividad } = event.data;

        if (type === 'RECORDATORIO') {
          // Evitar alertas duplicadas en el mismo minuto
          const alertaKey = `${actividad.id}-${actividad.hora}`;
          if (alertasMostradasRef.current.has(alertaKey)) return;
          alertasMostradasRef.current.add(alertaKey);

          // Lanzar notificación nativa
          lanzarNotificacion(actividad);

          // Leer en voz alta
          hablar(`Recordatorio: ${actividad.titulo}`);

          // Limpiar duplicados después de 2 minutos
          setTimeout(() => {
            alertasMostradasRef.current.delete(alertaKey);
          }, 120000);
        }
      };

      worker.postMessage({ type: 'UPDATE_ACTIVIDADES', data: saved });
      worker.postMessage({ type: 'START' });

      workerRef.current = worker;

      return () => {
        worker.postMessage({ type: 'STOP' });
        worker.terminate();
      };
    }
  }, []);

  // Actualizar el worker cuando cambian las actividades
  useEffect(() => {
    if (items.length > 0 || leerLocal(STORAGE_KEY)) {
      guardarLocal(STORAGE_KEY, items);
    }
    workerRef.current?.postMessage({
      type: 'UPDATE_ACTIVIDADES',
      data: items,
    });
  }, [items]);

  // ==========================================
  // NOTIFICACIONES Y VOZ
  // ==========================================
  const lanzarNotificacion = (actividad) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('⏰ Recordatorio', {
        body: actividad.titulo,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: actividad.id,
        requireInteraction: true,
      });
    }
  };

  const hablar = (texto) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Cancelar habla anterior
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-VE';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      window.speechSynthesis.speak(utterance);
    }
  };

  // ==========================================
  // CRUD
  // ==========================================
  const agregarActividad = (e) => {
    e.preventDefault();
    if (!titulo.trim() || !fecha || !hora) return;

    const nueva = {
      id: generarId(),
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      fecha,
      hora,
      completada: false,
      recordatorio_activado: true,
      created_at: new Date().toISOString(),
    };

    const nuevaLista = [nueva, ...items];
    setItems(nuevaLista);
    sincronizarConNube('actividades', nueva);

    setTitulo('');
    setDescripcion('');
    setHora('');
    setShowForm(false);
  };

  const toggleCompletada = (id) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, completada: !item.completada } : item
      )
    );
  };

  const toggleRecordatorio = (id) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? { ...item, recordatorio_activado: !item.recordatorio_activado }
          : item
      )
    );
  };

  const eliminarItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const limpiarCompletadas = () => {
    const pendientes = items.filter((item) => !item.completada);
    setItems(pendientes);
    guardarLocal(STORAGE_KEY, pendientes);
  };

  const probarVoz = (titulo) => {
    hablar(`Recordatorio: ${titulo}`);
  };

  // Separar hoy de otros días
  const hoy = new Date().toISOString().split('T')[0];
  const actividadesHoy = items.filter((i) => i.fecha === hoy);
  const actividadesOtros = items.filter((i) => i.fecha !== hoy);
  const completadas = items.filter((i) => i.completada).length;

  return (
    <div className="min-h-screen flex flex-col safe-bottom">
      {/* Header */}
      <header className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
            }}
            id="btn-back-actividades"
          >
            <ArrowLeft size={18} style={{ color: 'var(--text-secondary)' }} />
          </Link>
          <div>
            <h1
              className="text-lg font-bold"
              style={{ color: 'var(--actividades)' }}
            >
              📋 Actividades del Día
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Recordatorios con alerta por voz
            </p>
          </div>
        </div>
      </header>

      <StatusBar />

      <main className="flex-1 px-4 py-2 space-y-4">
        {/* Permiso de notificaciones */}
        {typeof Notification !== 'undefined' &&
          Notification.permission === 'default' && (
            <button
              onClick={() => {
                Notification.requestPermission().then((perm) => {
                  setNotificacionesPermitidas(perm === 'granted');
                });
              }}
              className="glass-card p-3 w-full text-left flex items-center gap-3 animate-fade-in"
              style={{
                borderColor: 'rgba(245, 158, 11, 0.3)',
                background: 'rgba(245, 158, 11, 0.08)',
              }}
              id="btn-enable-notifications"
            >
              <Bell size={20} style={{ color: 'var(--actividades)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--actividades)' }}>
                  Activar notificaciones
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Para recibir alertas de tus recordatorios
                </p>
              </div>
            </button>
          )}

        {/* Stats rápidas */}
        {items.length > 0 && (
          <div className="flex gap-2">
            <div
              className="flex-1 text-center py-2 rounded-lg"
              style={{
                background: 'var(--actividades-bg)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              <p className="text-lg font-bold" style={{ color: 'var(--actividades)' }}>
                {actividadesHoy.length}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Hoy
              </p>
            </div>
            <div
              className="flex-1 text-center py-2 rounded-lg"
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
                {completadas}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Completadas
              </p>
            </div>
            <div
              className="flex-1 text-center py-2 rounded-lg"
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <p className="text-lg font-bold" style={{ color: 'var(--supermercado)' }}>
                {items.length - completadas}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Pendientes
              </p>
            </div>
          </div>
        )}

        {/* Botón agregar / Formulario */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary w-full"
            style={{
              background:
                'linear-gradient(135deg, var(--actividades), #d97706)',
            }}
            id="btn-add-actividad"
          >
            <Plus size={20} />
            Nueva Actividad
          </button>
        ) : (
          <form
            onSubmit={agregarActividad}
            className="glass-card p-4 space-y-3 animate-slide-up"
            id="form-actividad"
          >
            <input
              type="text"
              placeholder="¿Qué necesitas hacer?"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="glass-input"
              autoFocus
              id="input-titulo-actividad"
            />
            <textarea
              placeholder="Descripción (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="glass-input"
              rows={2}
              style={{ resize: 'none' }}
              id="input-desc-actividad"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="text-xs mb-1 flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Calendar size={10} />
                  Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="glass-input"
                  id="input-fecha-actividad"
                />
              </div>
              <div>
                <label
                  className="text-xs mb-1 flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Clock size={10} />
                  Hora
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="glass-input"
                  id="input-hora-actividad"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary flex-1"
                style={{
                  background:
                    'linear-gradient(135deg, var(--actividades), #d97706)',
                }}
              >
                <Plus size={18} />
                Crear
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Actividades de HOY */}
        {actividadesHoy.length > 0 && (
          <>
            <p
              className="text-xs font-bold uppercase tracking-wider px-1"
              style={{ color: 'var(--actividades)' }}
            >
              📅 Hoy
            </p>
            <div className="space-y-2">
              {actividadesHoy.map((item, index) => (
                <ActivityCard
                  key={item.id}
                  item={item}
                  index={index}
                  onToggle={toggleCompletada}
                  onToggleRecordatorio={toggleRecordatorio}
                  onDelete={eliminarItem}
                  onTestVoice={probarVoz}
                />
              ))}
            </div>
          </>
        )}

        {/* Otras fechas */}
        {actividadesOtros.length > 0 && (
          <>
            <p
              className="text-xs font-bold uppercase tracking-wider px-1 pt-2"
              style={{ color: 'var(--text-muted)' }}
            >
              📆 Otros días
            </p>
            <div className="space-y-2">
              {actividadesOtros.map((item, index) => (
                <ActivityCard
                  key={item.id}
                  item={item}
                  index={index}
                  onToggle={toggleCompletada}
                  onToggleRecordatorio={toggleRecordatorio}
                  onDelete={eliminarItem}
                  onTestVoice={probarVoz}
                />
              ))}
            </div>
          </>
        )}

        {/* Limpiar completadas */}
        {completadas > 0 && (
          <button
            onClick={limpiarCompletadas}
            className="btn-danger w-full"
            id="btn-clear-completadas"
          >
            <Trash2 size={14} />
            Eliminar {completadas} completada{completadas !== 1 ? 's' : ''}
          </button>
        )}

        {/* Empty state */}
        {items.length === 0 && !showForm && (
          <div
            className="text-center py-12 animate-fade-in"
            style={{ color: 'var(--text-muted)' }}
          >
            <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">No hay actividades</p>
            <p className="text-xs mt-1">
              Crea tareas con recordatorios por voz
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

// ==========================================
// Componente de tarjeta de actividad
// ==========================================
function ActivityCard({ item, index, onToggle, onToggleRecordatorio, onDelete, onTestVoice }) {
  return (
    <div
      className={`glass-card p-3 animate-fade-in-up stagger-${Math.min(index + 1, 5)}`}
      style={{
        opacity: 0,
        ...(item.completada
          ? { opacity: 0.6, borderColor: 'rgba(16, 185, 129, 0.3)' }
          : {}),
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(item.id)}
          className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center transition-all"
          style={{
            border: item.completada
              ? '2px solid var(--accent)'
              : '2px solid var(--text-muted)',
            background: item.completada
              ? 'var(--accent)'
              : 'transparent',
          }}
        >
          {item.completada && (
            <Check size={14} style={{ color: 'var(--primary-dark)' }} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold"
            style={{
              color: item.completada
                ? 'var(--text-muted)'
                : 'var(--text-primary)',
              textDecoration: item.completada ? 'line-through' : 'none',
            }}
          >
            {item.titulo}
          </p>
          {item.descripcion && (
            <p
              className="text-xs mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              {item.descripcion}
            </p>
          )}
          <div
            className="flex items-center gap-3 mt-1.5 text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-1">
              <Calendar size={9} />
              {item.fecha}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={9} />
              {item.hora}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onTestVoice(item.titulo)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--supermercado)' }}
            title="Probar voz"
          >
            <Volume2 size={14} />
          </button>
          <button
            onClick={() => onToggleRecordatorio(item.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color: item.recordatorio_activado
                ? 'var(--actividades)'
                : 'var(--text-muted)',
            }}
            title={
              item.recordatorio_activado
                ? 'Desactivar recordatorio'
                : 'Activar recordatorio'
            }
          >
            {item.recordatorio_activado ? (
              <Bell size={14} />
            ) : (
              <BellOff size={14} />
            )}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#ef4444' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

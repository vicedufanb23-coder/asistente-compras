'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, ArrowLeft, Bell, BellOff, Check,
  Clock, Calendar, Volume2, ClipboardList, Mic, MicOff, Pencil
} from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import StatusBar from '@/components/StatusBar';
import { guardarLocal, leerLocal, generarId, sincronizarConNube } from '@/lib/storage';

const STORAGE_KEY = 'actividades_lista';
const STORAGE_KEY_ALERTS = 'actividad_alerta_ultima';

export default function ActividadesPage() {
  const [items, setItems] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [notificacionesPermitidas, setNotificacionesPermitidas] = useState(false);
  const workerRef = useRef(null);
  const alertasMostradasRef = useRef(new Map());

  const [isListeningTitle, setIsListeningTitle] = useState(false);
  const [isListeningDesc, setIsListeningDesc] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // ==========================================
  // Cargar estado persistente de alertas al iniciar
  // ==========================================
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY_ALERTS);
    if (guardado) {
      try {
        const datos = JSON.parse(guardado);
        // Convertir array de [key, timestamp] a Map
        alertasMostradasRef.current = new Map(datos);
        // Limpiar entradas viejas (más de 24 horas)
        const ahora = Date.now();
        const filtrado = new Map();
        for (const [key, timestamp] of alertasMostradasRef.current) {
          if (ahora - timestamp < 24 * 60 * 60 * 1000) {
            filtrado.set(key, timestamp);
          }
        }
        if (filtrado.size !== alertasMostradasRef.current.size) {
          alertasMostradasRef.current = filtrado;
          guardarLocalStorageAlerts();
        }
      } catch (e) {
        console.error('Error parsing alerts storage', e);
        alertasMostradasRef.current = new Map();
      }
    } else {
      alertasMostradasRef.current = new Map();
    }
  }, []);

  // Guardar estado de alertas en localStorage cuando cambia
  useEffect(() => {
    if (alertasMostradasRef.current) {
      guardarLocalStorageAlerts();
    }
  }, [alertasMostradasRef]);

  const guardarLocalStorageAlerts = () => {
    if (alertasMostradasRef.current) {
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(Array.from(alertasMostradasRef.current.entries())));
    }
  };

  // ==========================================
  // INICIALIZAR WORKER Y CARGAR DATOS
  // ==========================================
  useEffect(() => {
    const saved = leerLocal(STORAGE_KEY, []);
    setItems(saved);

    // Fecha por defecto: hoy
    const hoy = new Date().toISOString().split('T')[0];
    setFecha(hoy);

    // Check speech recognition support
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSpeechSupported(!!SpeechRecognition);

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
          // Verificar deduplicación con persistencia en localStorage
          const alertaKey = `${actividad.id}-${actividad.hora}`;
          const ultimaHora = alertasMostradasRef.current.get(alertaKey);

          // Si ya se avisó hace menos de 2 minutos, no volver a avisar
          if (ultimaHora) {
            const tiempoDesdeUltima = Date.now() - ultimaHora;
            if (tiempoDesdeUltima < 120000) {
              // Ya avisó hace menos de 2 min, pero actualizar timestamp para persistir
              alertasMostradasRef.current.set(alertaKey, Date.now());
              guardarLocalStorageAlerts();
              return;
            } else {
              // La entrada es vieja, removerla
              alertasMostradasRef.current.delete(alertaKey);
              guardarLocalStorageAlerts();
            }
          }

          // Lanzar notificación nativa
          lanzarNotificacion(actividad);

          // Leer en voz alta
          hablar(`Jefe disculpe le recuerdo: ${actividad.titulo}`);

          // Registrar esta alerta con marca de tiempo actual
          alertasMostradasRef.current.set(alertaKey, Date.now());

          // Guardar inmediatamente en localStorage
          guardarLocalStorageAlerts();

          // Limpiar duplicados después de 2 minutos (persistente)
          setTimeout(() => {
            alertasMostradasRef.current.delete(alertaKey);
            guardarLocalStorageAlerts();
          }, 120000);
        }
      };

      worker.postMessage({ type: 'UPDATE_ACTIVIDADES', data: saved });
      worker.postMessage({ type: 'START' });

      // === SYNC WITH SERVICE WORKER ===
      // Leer actividades guardadas y enviarlas al SW para background checking
      if (typeof serviceWorker !== 'undefined') {
        navigator.serviceWorker.ready.then((reg) => {
          reg.active.postMessage({
            type: 'UPDATE_ACTIVIDADES',
            actividad: saved,
          });
        });
      }

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
  // SPEECH-TO-TEXT (Dictado por voz nativo)
  // ==========================================
  const toggleDictado = (target) => {
    if (target === 'title' && isListeningTitle) {
      recognitionRef.current?.stop();
      setIsListeningTitle(false);
      return;
    }
    if (target === 'desc' && isListeningDesc) {
      recognitionRef.current?.stop();
      setIsListeningDesc(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-VE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (target === 'title') {
        setTitulo(transcript);
        setIsListeningTitle(false);
      } else {
        setDescripcion(transcript);
        setIsListeningDesc(false);
      }
    };

    recognition.onerror = () => {
      if (target === 'title') setIsListeningTitle(false);
      else setIsListeningDesc(false);
    };

    recognition.onend = () => {
      if (target === 'title') setIsListeningTitle(false);
      else setIsListeningDesc(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    if (target === 'title') {
      setIsListeningTitle(true);
      setIsListeningDesc(false);
    } else {
      setIsListeningDesc(true);
      setIsListeningTitle(false);
    }
  };

  // ==========================================
  // NOTIFICACIONES Y VOZ
  // ==========================================
  const lanzarNotificacion = (actividad) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Jefe disculpe le recuerdo: ⏰', {
        body: `Jefe disculpe le recuerdo: ${actividad.titulo}`,
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

    if (editId) {
      const nuevaLista = items.map((item) =>
        item.id === editId
          ? {
              ...item,
              titulo: titulo.trim(),
              descripcion: descripcion.trim(),
              fecha,
              hora,
            }
          : item
      );
      setItems(nuevaLista);
      sincronizarConNube('actividades', {
        id: editId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fecha,
        hora,
      });
      setEditId(null);
    } else {
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
    }

    setTitulo('');
    setDescripcion('');
    const hoy = new Date().toISOString().split('T')[0];
    setFecha(hoy);
    setHora('');
    setShowForm(false);
  };

  const iniciarEdicion = (item) => {
    setTitulo(item.titulo);
    setDescripcion(item.descripcion || '');
    setFecha(item.fecha);
    setHora(item.hora);
    setEditId(item.id);
    setShowForm(true);
  };

  const cancelarFormulario = () => {
    setTitulo('');
    setDescripcion('');
    const hoy = new Date().toISOString().split('T')[0];
    setFecha(hoy);
    setHora('');
    setEditId(null);
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
    // También limpiar la alerta guardada para este item
    if (alertasMostradasRef.current) {
      alertasMostradasRef.current.delete(`${id}-${new Date().toISOString().split('T')[0]}`);
      guardarLocalStorageAlerts();
    }
  };

  const limpiarCompletadas = () => {
    const pendientes = items.filter((item) => !item.completada);
    setItems(pendientes);
    guardarLocal(STORAGE_KEY, pendientes);
  };

  const probarVoz = (titulo) => {
    hablar(`Jefe disculpe le recuerdo: ${titulo}`);
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
            {/* Input de título con micrófono */}
            <div className="relative">
              <input
                type="text"
                placeholder="¿Qué necesitas hacer?"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="glass-input pr-14"
                autoFocus
                id="input-titulo-actividad"
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => toggleDictado('title')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isListeningTitle ? 'animate-mic-pulse' : ''
                  }`}
                  style={{
                    background: isListeningTitle
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'var(--surface-elevated)',
                    color: isListeningTitle ? '#ef4444' : 'var(--actividades)',
                    border: `1px solid ${
                      isListeningTitle
                        ? 'rgba(239, 68, 68, 0.4)'
                        : 'var(--border)'
                    }`,
                  }}
                >
                  {isListeningTitle ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
            </div>

            {isListeningTitle && (
              <p
                className="text-[10px] text-center animate-fade-in"
                style={{ color: '#ef4444' }}
              >
                🎙️ Dictando el título... habla ahora
              </p>
            )}

            {/* Input de descripción con micrófono */}
            <div className="relative">
              <textarea
                placeholder="Descripción (opcional)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="glass-input pr-14"
                rows={2}
                style={{ resize: 'none' }}
                id="input-desc-actividad"
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => toggleDictado('desc')}
                  className={`absolute right-2 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isListeningDesc ? 'animate-mic-pulse' : ''
                  }`}
                  style={{
                    background: isListeningDesc
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'var(--surface-elevated)',
                    color: isListeningDesc ? '#ef4444' : 'var(--actividades)',
                    border: `1px solid ${
                      isListeningDesc
                        ? 'rgba(239, 68, 68, 0.4)'
                        : 'var(--border)'
                    }`,
                  }}
                >
                  {isListeningDesc ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
            </div>

            {isListeningDesc && (
              <p
                className="text-[10px] text-center animate-fade-in"
                style={{ color: '#ef4444' }}
              >
                🎙️ Dictando la descripción... habla ahora
              </p>
            )}

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
                {editId ? 'Guardar' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={cancelarFormulario}
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
                  onEdit={iniciarEdicion}
                />
              )}
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
                  onEdit={iniciarEdicion}
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
function ActivityCard({ item, index, onToggle, onToggleRecordatorio, onDelete, onTestVoice, onEdit }) {
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
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
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
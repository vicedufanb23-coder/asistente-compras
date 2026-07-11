'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Scale, ArrowLeft, DollarSign, Mic, MicOff } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import StatusBar from '@/components/StatusBar';
import { guardarLocal, leerLocal, generarId, sincronizarConNube } from '@/lib/storage';
import { obtenerTasaBCV, convertirVesAUsd } from '@/lib/bcv';

const STORAGE_KEY = 'verduras_lista';

export default function VerdurasPage() {
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState('');
  const [precioKg, setPrecioKg] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [tasaBcv, setTasaBcv] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // Cargar datos locales al montar
  useEffect(() => {
    const saved = leerLocal(STORAGE_KEY, []);
    setItems(saved);

    obtenerTasaBCV().then((r) => setTasaBcv(r.tasa));

    // Check speech recognition support
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // ==========================================
  // SPEECH-TO-TEXT (Dictado por voz nativo)
  // ==========================================
  const toggleDictado = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
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
      setNombre(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Guardar en local cada vez que cambia la lista
  useEffect(() => {
    if (items.length > 0 || leerLocal(STORAGE_KEY)) {
      guardarLocal(STORAGE_KEY, items);
    }
  }, [items]);

  const agregarItem = (e) => {
    e.preventDefault();
    if (!nombre.trim() || !precioKg || !pesoKg) return;

    const precio = parseFloat(precioKg);
    const peso = parseFloat(pesoKg);
    const subtotal = parseFloat((precio * peso).toFixed(2));

    const nuevoItem = {
      id: generarId(),
      nombre: nombre.trim(),
      precio_kg: precio,
      peso_kg: peso,
      subtotal,
      moneda: 'VES',
      created_at: new Date().toISOString(),
    };

    const nuevaLista = [nuevoItem, ...items];
    setItems(nuevaLista);

    // Sync silencioso a Supabase
    sincronizarConNube('verduras', nuevoItem);

    // Limpiar formulario
    setNombre('');
    setPrecioKg('');
    setPesoKg('');
    setShowForm(false);
  };

  const eliminarItem = (id) => {
    const nuevaLista = items.filter((item) => item.id !== id);
    setItems(nuevaLista);
  };

  const limpiarTodo = () => {
    if (confirm('¿Borrar toda la lista de verduras?')) {
      setItems([]);
      guardarLocal(STORAGE_KEY, []);
    }
  };

  const totalVes = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalUsd = tasaBcv > 0 ? convertirVesAUsd(totalVes, tasaBcv) : 0;

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
            id="btn-back-verduras"
          >
            <ArrowLeft size={18} style={{ color: 'var(--text-secondary)' }} />
          </Link>
          <div>
            <h1
              className="text-lg font-bold"
              style={{ color: 'var(--verduras)' }}
            >
              🥬 Verduras y Hortalizas
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Cálculo por peso — 100% offline
            </p>
          </div>
        </div>
      </header>

      <StatusBar />

      <main className="flex-1 px-4 py-2 space-y-4">
        {/* Botón agregar / Formulario */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary w-full"
            style={{
              background:
                'linear-gradient(135deg, var(--verduras), #16a34a)',
            }}
            id="btn-add-verdura"
          >
            <Plus size={20} />
            Agregar Verdura / Hortaliza
          </button>
        ) : (
          <form
            onSubmit={agregarItem}
            className="glass-card p-4 space-y-3 animate-slide-up"
            id="form-verdura"
          >
            {/* Input de nombre con micrófono */}
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre (ej: Tomate, Cebolla)"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="glass-input pr-14"
                autoFocus
                id="input-nombre-verdura"
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleDictado}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isListening ? 'animate-mic-pulse' : ''
                  }`}
                  style={{
                    background: isListening
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'var(--surface-elevated)',
                    color: isListening ? '#ef4444' : 'var(--verduras)',
                    border: `1px solid ${
                      isListening
                        ? 'rgba(239, 68, 68, 0.4)'
                        : 'var(--border)'
                    }`,
                  }}
                  id="btn-mic-verdura"
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
            </div>

            {isListening && (
              <p
                className="text-xs text-center animate-fade-in"
                style={{ color: '#ef4444' }}
              >
                🎙️ Escuchando... habla ahora
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Precio / Kg (Bs)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={precioKg}
                  onChange={(e) => setPrecioKg(e.target.value)}
                  className="glass-input"
                  id="input-precio-kg"
                />
              </div>
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Peso (Kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={pesoKg}
                  onChange={(e) => setPesoKg(e.target.value)}
                  className="glass-input"
                  id="input-peso-kg"
                />
              </div>
            </div>

            {/* Preview del subtotal */}
            {precioKg && pesoKg && (
              <div
                className="text-center py-2 rounded-lg animate-fade-in"
                style={{
                  background: 'var(--verduras-bg)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Subtotal:{' '}
                </span>
                <span
                  className="text-lg font-bold"
                  style={{ color: 'var(--verduras)' }}
                >
                  Bs {(parseFloat(precioKg || 0) * parseFloat(pesoKg || 0)).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" style={{ background: 'linear-gradient(135deg, var(--verduras), #16a34a)' }}>
                <Plus size={18} />
                Agregar
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

        {/* Lista de items */}
        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {items.length} artículo{items.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={limpiarTodo}
                className="btn-danger"
                id="btn-clear-verduras"
              >
                <Trash2 size={12} />
                Limpiar
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`glass-card p-3 flex items-center justify-between animate-fade-in-up stagger-${Math.min(index + 1, 5)}`}
                  style={{ opacity: 0 }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.nombre}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Scale size={10} className="inline mr-1" />
                      {item.peso_kg} kg × Bs {item.precio_kg.toFixed(2)}/kg
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--verduras)' }}
                      >
                        Bs {item.subtotal.toFixed(2)}
                      </p>
                      {tasaBcv > 0 && (
                        <p
                          className="text-[10px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          ${convertirVesAUsd(item.subtotal, tasaBcv).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => eliminarItem(item.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div
              className="glass-card p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))',
                borderColor: 'rgba(34, 197, 94, 0.3)',
              }}
              id="total-verduras"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  TOTAL
                </span>
                <div className="text-right">
                  <p
                    className="text-xl font-extrabold"
                    style={{ color: 'var(--verduras)' }}
                  >
                    Bs {totalVes.toFixed(2)}
                  </p>
                  {tasaBcv > 0 && (
                    <p
                      className="text-xs flex items-center justify-end gap-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <DollarSign size={10} />
                      {totalUsd.toFixed(2)} USD
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {items.length === 0 && !showForm && (
          <div
            className="text-center py-12 animate-fade-in"
            style={{ color: 'var(--text-muted)' }}
          >
            <Scale size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">No hay artículos todavía</p>
            <p className="text-xs mt-1">
              Presiona el botón para agregar verduras
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

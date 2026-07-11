'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Mic, MicOff, ArrowLeft, DollarSign,
  ShoppingCart, ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import StatusBar from '@/components/StatusBar';
import {
  guardarLocal, leerLocal, generarId, sincronizarConNube,
} from '@/lib/storage';
import {
  obtenerTasaBCV, convertirUsdAVes, convertirVesAUsd,
} from '@/lib/bcv';

const STORAGE_KEY = 'supermercado_lista';

export default function SupermercadoPage() {
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [monedaInput, setMonedaInput] = useState('USD'); // USD o VES
  const [tasaBcv, setTasaBcv] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

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

  useEffect(() => {
    if (items.length > 0 || leerLocal(STORAGE_KEY)) {
      guardarLocal(STORAGE_KEY, items);
    }
  }, [items]);

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

  // ==========================================
  // CRUD
  // ==========================================
  const agregarItem = (e) => {
    e.preventDefault();
    if (!nombre.trim() || !precio) return;

    const precioNum = parseFloat(precio);
    const cantidadNum = parseInt(cantidad) || 1;
    const precioTotal = precioNum * cantidadNum;

    let precioUsd, precioVes;
    if (monedaInput === 'USD') {
      precioUsd = precioTotal;
      precioVes = tasaBcv > 0 ? convertirUsdAVes(precioTotal, tasaBcv) : 0;
    } else {
      precioVes = precioTotal;
      precioUsd = tasaBcv > 0 ? convertirVesAUsd(precioTotal, tasaBcv) : 0;
    }

    const nuevoItem = {
      id: generarId(),
      nombre: nombre.trim(),
      precio: precioNum,
      cantidad: cantidadNum,
      moneda_original: monedaInput,
      tasa_bcv: tasaBcv,
      precio_usd: parseFloat(precioUsd.toFixed(2)),
      precio_ves: parseFloat(precioVes.toFixed(2)),
      created_at: new Date().toISOString(),
    };

    const nuevaLista = [nuevoItem, ...items];
    setItems(nuevaLista);
    sincronizarConNube('supermercado', nuevoItem);

    setNombre('');
    setPrecio('');
    setCantidad('1');
    setShowForm(false);
  };

  const eliminarItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const limpiarTodo = () => {
    if (confirm('¿Borrar toda la lista del supermercado?')) {
      setItems([]);
      guardarLocal(STORAGE_KEY, []);
    }
  };

  const totalUsd = items.reduce((sum, item) => sum + item.precio_usd, 0);
  const totalVes = items.reduce((sum, item) => sum + item.precio_ves, 0);

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
            id="btn-back-super"
          >
            <ArrowLeft size={18} style={{ color: 'var(--text-secondary)' }} />
          </Link>
          <div>
            <h1
              className="text-lg font-bold"
              style={{ color: 'var(--supermercado)' }}
            >
              🛒 Supermercado
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Dictado por voz + conversión BCV
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
                'linear-gradient(135deg, var(--supermercado), #2563eb)',
            }}
            id="btn-add-super"
          >
            <Plus size={20} />
            Agregar Producto
          </button>
        ) : (
          <form
            onSubmit={agregarItem}
            className="glass-card p-4 space-y-3 animate-slide-up"
            id="form-supermercado"
          >
            {/* Input de nombre con micrófono */}
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre del producto (o dicta por voz)"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="glass-input pr-14"
                autoFocus
                id="input-nombre-super"
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
                    color: isListening ? '#ef4444' : 'var(--supermercado)',
                    border: `1px solid ${
                      isListening
                        ? 'rgba(239, 68, 68, 0.4)'
                        : 'var(--border)'
                    }`,
                  }}
                  id="btn-mic"
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

            {/* Precio y moneda */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <label
                  className="text-xs mb-1 block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Precio unitario
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="glass-input"
                  id="input-precio-super"
                />
              </div>
              <div className="col-span-1">
                <label
                  className="text-xs mb-1 block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="glass-input"
                  id="input-cantidad-super"
                />
              </div>
              <div className="col-span-2">
                <label
                  className="text-xs mb-1 block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Moneda
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setMonedaInput('USD')}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background:
                        monedaInput === 'USD'
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'var(--surface-glass)',
                      color:
                        monedaInput === 'USD'
                          ? 'var(--supermercado)'
                          : 'var(--text-muted)',
                      border: `1px solid ${
                        monedaInput === 'USD'
                          ? 'rgba(59, 130, 246, 0.4)'
                          : 'var(--border)'
                      }`,
                    }}
                  >
                    $ USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonedaInput('VES')}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background:
                        monedaInput === 'VES'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'var(--surface-glass)',
                      color:
                        monedaInput === 'VES'
                          ? 'var(--verduras)'
                          : 'var(--text-muted)',
                      border: `1px solid ${
                        monedaInput === 'VES'
                          ? 'rgba(34, 197, 94, 0.4)'
                          : 'var(--border)'
                      }`,
                    }}
                  >
                    Bs VES
                  </button>
                </div>
              </div>
            </div>

            {/* Preview de conversión */}
            {precio && tasaBcv > 0 && (
              <div
                className="flex items-center justify-center gap-2 py-2 rounded-lg animate-fade-in"
                style={{
                  background: 'var(--supermercado-bg)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {monedaInput === 'USD'
                    ? `$${(parseFloat(precio || 0) * parseInt(cantidad || 1)).toFixed(2)}`
                    : `Bs ${(parseFloat(precio || 0) * parseInt(cantidad || 1)).toFixed(2)}`}
                </span>
                <ArrowRightLeft size={12} style={{ color: 'var(--supermercado)' }} />
                <span
                  className="text-sm font-bold"
                  style={{ color: 'var(--supermercado)' }}
                >
                  {monedaInput === 'USD'
                    ? `Bs ${convertirUsdAVes(parseFloat(precio || 0) * parseInt(cantidad || 1), tasaBcv).toFixed(2)}`
                    : `$${convertirVesAUsd(parseFloat(precio || 0) * parseInt(cantidad || 1), tasaBcv).toFixed(2)}`}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary flex-1"
                style={{
                  background:
                    'linear-gradient(135deg, var(--supermercado), #2563eb)',
                }}
              >
                <Plus size={18} />
                Agregar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setIsListening(false);
                  recognitionRef.current?.stop();
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Lista de productos */}
        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {items.length} producto{items.length !== 1 ? 's' : ''}
              </span>
              <button onClick={limpiarTodo} className="btn-danger" id="btn-clear-super">
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
                      {item.cantidad > 1
                        ? `${item.cantidad} × ${item.moneda_original === 'USD' ? '$' : 'Bs '}${item.precio.toFixed(2)}`
                        : `${item.moneda_original === 'USD' ? '$' : 'Bs '}${item.precio.toFixed(2)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--supermercado)' }}
                      >
                        ${item.precio_usd.toFixed(2)}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Bs {item.precio_ves.toFixed(2)}
                      </p>
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
                background:
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.04))',
                borderColor: 'rgba(59, 130, 246, 0.3)',
              }}
              id="total-supermercado"
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
                    style={{ color: 'var(--supermercado)' }}
                  >
                    ${totalUsd.toFixed(2)}
                  </p>
                  <p
                    className="text-xs flex items-center justify-end gap-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Bs {totalVes.toFixed(2)}
                  </p>
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
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Tu lista está vacía</p>
            <p className="text-xs mt-1">
              {speechSupported
                ? 'Dicta o escribe tus productos'
                : 'Agrega productos a tu lista'}
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

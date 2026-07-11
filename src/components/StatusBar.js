'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, DollarSign, RefreshCw } from 'lucide-react';
import { obtenerTasaBCV } from '@/lib/bcv';
import { hayInternet, escucharConectividad } from '@/lib/storage';

export default function StatusBar() {
  const [online, setOnline] = useState(true);
  const [tasa, setTasa] = useState(null);
  const [fuenteTasa, setFuenteTasa] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargarTasa = async () => {
    setCargando(true);
    try {
      const resultado = await obtenerTasaBCV();
      setTasa(resultado.tasa);
      setFuenteTasa(resultado.fuente);
    } catch {
      setFuenteTasa('error');
    }
    setCargando(false);
  };

  useEffect(() => {
    setOnline(hayInternet());
    cargarTasa();

    const cleanup = escucharConectividad(
      () => {
        setOnline(true);
        cargarTasa(); // Actualizar tasa al recuperar conexión
      },
      () => setOnline(false)
    );

    // Actualizar tasa cada 10 minutos
    const interval = setInterval(cargarTasa, 10 * 60 * 1000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      id="status-bar"
    >
      {/* Estado de conexión */}
      <div
        className={`status-badge ${online ? 'status-online' : 'status-offline'}`}
        id="connection-status"
      >
        {online ? (
          <>
            <Wifi size={12} />
            <span>En línea</span>
          </>
        ) : (
          <>
            <WifiOff size={12} />
            <span>Sin conexión</span>
          </>
        )}
      </div>

      {/* Tasa BCV */}
      <button
        onClick={cargarTasa}
        disabled={cargando}
        className="status-badge"
        style={{
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          cursor: 'pointer',
        }}
        title={fuenteTasa}
        id="tasa-bcv-badge"
      >
        <DollarSign size={12} />
        <span>
          {tasa !== null && tasa > 0
            ? `BCV: ${tasa.toFixed(2)} Bs`
            : 'Sin tasa'}
        </span>
        <RefreshCw
          size={10}
          className={cargando ? 'animate-spin' : ''}
          style={{ opacity: 0.6 }}
        />
      </button>
    </div>
  );
}

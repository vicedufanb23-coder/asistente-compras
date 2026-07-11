'use client';

import Link from 'next/link';
import { Leaf, ShoppingCart, ClipboardList, ChevronRight } from 'lucide-react';
import StatusBar from '@/components/StatusBar';
import BottomNav from '@/components/BottomNav';

const modules = [
  {
    name: 'Verduras y Hortalizas',
    description: 'Calcula el precio por peso de verduras, frutas y hortalizas. Totalmente offline.',
    href: '/verduras',
    icon: Leaf,
    color: 'var(--verduras)',
    bgColor: 'var(--verduras-bg)',
    emoji: '🥬',
    gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))',
  },
  {
    name: 'Supermercado',
    description: 'Dicta tus productos por voz y convierte precios USD ↔ VES con tasa BCV.',
    href: '/supermercado',
    icon: ShoppingCart,
    color: 'var(--supermercado)',
    bgColor: 'var(--supermercado-bg)',
    emoji: '🛒',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))',
  },
  {
    name: 'Actividades del Día',
    description: 'Crea recordatorios con alerta por voz. Tu asistente personal de tareas.',
    href: '/actividades',
    icon: ClipboardList,
    color: 'var(--actividades)',
    bgColor: 'var(--actividades-bg)',
    emoji: '📋',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col safe-bottom">
      {/* Header */}
      <header className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            }}
          >
            🛒
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Súper Compras
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Calculadora inteligente de compras
            </p>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <StatusBar />

      {/* Modules Grid */}
      <main className="flex-1 px-4 py-4 space-y-4">
        <p
          className="text-sm font-medium px-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          ¿Qué necesitas hoy?
        </p>

        {modules.map((mod, index) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.name}
              href={mod.href}
              className={`glass-card block p-5 animate-fade-in-up stagger-${index + 1}`}
              style={{
                opacity: 0,
                background: mod.gradient,
                borderColor: `${mod.color}22`,
              }}
              id={`module-${mod.href.slice(1)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{
                      background: mod.bgColor,
                      border: `1px solid ${mod.color}33`,
                    }}
                  >
                    {mod.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2
                      className="text-base font-bold mb-1"
                      style={{ color: mod.color }}
                    >
                      {mod.name}
                    </h2>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {mod.description}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={20}
                  className="flex-shrink-0 mt-1"
                  style={{ color: mod.color, opacity: 0.5 }}
                />
              </div>
            </Link>
          );
        })}

        {/* Info Card */}
        <div
          className="glass-card p-4 mt-6 animate-fade-in-up stagger-4"
          style={{
            opacity: 0,
            background: 'rgba(16, 185, 129, 0.05)',
            borderColor: 'rgba(16, 185, 129, 0.15)',
          }}
        >
          <p
            className="text-xs leading-relaxed text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            ✨ <strong style={{ color: 'var(--accent)' }}>100% Offline</strong> — Todos tus
            datos se guardan en tu teléfono. Funciona sin internet. Hecho para
            Venezuela 🇻🇪
          </p>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

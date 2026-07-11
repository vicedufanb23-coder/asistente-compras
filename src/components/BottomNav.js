'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Leaf, ShoppingCart, ClipboardList } from 'lucide-react';

const navItems = [
  { name: 'Inicio', href: '/', icon: Home },
  { name: 'Verduras', href: '/verduras', icon: Leaf },
  { name: 'Súper', href: '/supermercado', icon: ShoppingCart },
  { name: 'Actividades', href: '/actividades', icon: ClipboardList },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" id="bottom-navigation">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname?.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            id={`nav-${item.name.toLowerCase()}`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

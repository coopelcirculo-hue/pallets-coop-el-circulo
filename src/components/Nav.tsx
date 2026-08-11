"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación principal: las 5 pantallas del sistema.
 * Pensada para tablet: botones grandes, fáciles de tocar con la mano sucia de fábrica.
 */

const PANTALLAS = [
  { href: "/", icono: "🏠", texto: "Inicio" },
  { href: "/nuevo-pallet", icono: "📦", texto: "Nuevo pallet" },
  { href: "/historial", icono: "📋", texto: "Historial" },
  { href: "/reimpresion", icono: "🖨️", texto: "Reimpresión" },
  { href: "/configuracion", icono: "⚙️", texto: "Configuración" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white">
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 py-2">
        {PANTALLAS.map((pantalla) => {
          const activa = pathname === pantalla.href;
          return (
            <li key={pantalla.href}>
              <Link
                href={pantalla.href}
                className={`flex min-h-14 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-base font-medium transition-colors ${
                  activa
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                }`}
              >
                <span aria-hidden>{pantalla.icono}</span>
                {pantalla.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

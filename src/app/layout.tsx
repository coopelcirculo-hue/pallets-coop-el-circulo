import type { Metadata, Viewport } from "next";

import Nav from "@/components/Nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pallets · Tomás Dotti",
  description: "Registro de pallets de producción e impresión de etiquetas en Zebra ZD421",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // La tablet no debe hacer zoom accidental al tocar los inputs.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <header className="bg-slate-900 px-4 py-3 text-white">
          <div className="mx-auto max-w-5xl">
            <p className="text-lg font-bold tracking-wide">TOMÁS DOTTI</p>
            <p className="text-sm text-slate-300">Registro de pallets</p>
          </div>
        </header>

        <Nav />

        <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
      </body>
    </html>
  );
}

import { NextResponse } from "next/server";

import { obtenerEstadoSistema } from "@/lib/health";

// Siempre en vivo: nunca cachear el chequeo de salud.
export const dynamic = "force-dynamic";

/** GET /api/health → estado de configuración, Supabase e impresora. */
export async function GET() {
  const estado = await obtenerEstadoSistema();
  const todoOk = estado.faltantes.length === 0 && estado.supabase.estado === "ok";

  return NextResponse.json(
    { ok: todoOk, ...estado },
    { status: todoOk ? 200 : 503 },
  );
}

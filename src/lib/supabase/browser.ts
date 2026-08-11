"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Cliente de Supabase para el navegador (clave anónima, respeta RLS).
 *
 * Se usa solo para LECTURAS de pantalla (por ejemplo refrescar el estado de
 * impresión de un pallet). Toda escritura pasa siempre por las API Routes.
 */

let cliente: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (cliente) return cliente;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }

  cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  return cliente;
}

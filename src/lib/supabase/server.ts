import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { leerEnv } from "@/lib/env";

/**
 * Cliente de Supabase con la SERVICE ROLE KEY.
 *
 * Esta clave saltea Row Level Security, así que NUNCA puede llegar al navegador.
 * El import de "server-only" hace que el build falle si alguien importa este
 * archivo desde un componente de cliente por accidente.
 *
 * Es el cliente que usan las API Routes para crear pallets, generar el número
 * de la secuencia y actualizar el estado de impresión.
 */

let cliente: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  // Se crea una sola vez por proceso (patrón singleton) para no abrir
  // conexiones nuevas en cada request.
  if (cliente) return cliente;

  const url = leerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = leerEnv("SUPABASE_SERVICE_ROLE_KEY");

  cliente = createClient(url, serviceRoleKey, {
    auth: {
      // No hay usuarios logueados del lado del servidor: no persistir sesión.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cliente;
}

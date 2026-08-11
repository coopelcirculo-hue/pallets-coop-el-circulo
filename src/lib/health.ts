import "server-only";

import { estadoDeVariables, variablesFaltantes, type VariableRequerida } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getConfigZebra, zebraEstaConfigurada } from "@/lib/zebra/config";

/**
 * Chequeo de salud del sistema.
 * Lo usan la pantalla de Inicio y la ruta /api/health para mostrar de un vistazo
 * si falta configuración. No expone claves: solo dice si están cargadas.
 */

export type EstadoSupabase = "ok" | "sin_tablas" | "sin_configurar" | "error";

export type EstadoSistema = {
  variables: Record<VariableRequerida, boolean>;
  faltantes: VariableRequerida[];
  supabase: {
    estado: EstadoSupabase;
    detalle: string;
  };
  zebra: {
    configurada: boolean;
    destino: string | null; // "192.168.1.50:9100"
  };
};

/** Códigos que devuelve Supabase/Postgres cuando la tabla todavía no existe. */
const CODIGOS_TABLA_INEXISTENTE = ["42P01", "PGRST205"];

async function chequearSupabase(): Promise<EstadoSistema["supabase"]> {
  try {
    const supabase = getSupabaseAdmin();

    // Consulta mínima contra una tabla del modelo. Si la conexión anda pero la
    // tabla no existe, quiere decir que falta correr las migraciones (Etapa 2).
    const { error } = await supabase.from("clientes").select("id").limit(1);

    if (!error) {
      return { estado: "ok", detalle: "Conectado y con las tablas creadas." };
    }

    if (CODIGOS_TABLA_INEXISTENTE.includes(error.code ?? "")) {
      return {
        estado: "sin_tablas",
        detalle: "Conectado, pero faltan las tablas. Corré los scripts de la Etapa 2.",
      };
    }

    return { estado: "error", detalle: error.message };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    // leerEnv() explota acá si falta la URL o la service role key.
    return { estado: "sin_configurar", detalle: mensaje };
  }
}

function chequearZebra(): EstadoSistema["zebra"] {
  if (!zebraEstaConfigurada()) {
    return { configurada: false, destino: null };
  }
  try {
    const { ip, puerto } = getConfigZebra();
    return { configurada: true, destino: `${ip}:${puerto}` };
  } catch {
    return { configurada: false, destino: null };
  }
}

export async function obtenerEstadoSistema(): Promise<EstadoSistema> {
  return {
    variables: estadoDeVariables(),
    faltantes: variablesFaltantes(),
    supabase: await chequearSupabase(),
    zebra: chequearZebra(),
  };
}

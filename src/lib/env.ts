/**
 * Lectura y validación de variables de entorno.
 *
 * Regla: NADA se valida al importar este archivo. Cada helper falla solo cuando
 * se lo usa de verdad. Así el proyecto levanta aunque falte configuración y la
 * ruta /api/health puede reportar con claridad qué falta, en vez de romper el build.
 */

/**
 * Variables públicas (llegan al navegador).
 * Se referencian de forma LITERAL a propósito: Next.js las reemplaza en tiempo de
 * build solo si aparecen escritas como `process.env.NEXT_PUBLIC_ALGO`.
 * Si se leyeran dinámicamente (process.env[nombre]) quedarían vacías en el browser.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Nombres de las variables que el sistema necesita para funcionar completo. */
export const VARIABLES_REQUERIDAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ZEBRA_IP",
  "ZEBRA_PORT",
] as const;

export type VariableRequerida = (typeof VARIABLES_REQUERIDAS)[number];

/**
 * Lee una variable de entorno y explota con un mensaje entendible si falta.
 * Usar solo en código de servidor (API Routes, Server Components).
 */
export function leerEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === "") {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copiá .env.example a .env.local y completala.`,
    );
  }
  return valor.trim();
}

/** Igual que leerEnv pero devuelve null en vez de fallar. */
export function leerEnvOpcional(nombre: string): string | null {
  const valor = process.env[nombre];
  return valor && valor.trim() !== "" ? valor.trim() : null;
}

/**
 * Devuelve el estado de configuración de cada variable requerida.
 * No expone los valores: solo si están cargadas o no. Lo usa /api/health.
 */
export function estadoDeVariables(): Record<VariableRequerida, boolean> {
  const estado = {} as Record<VariableRequerida, boolean>;
  for (const nombre of VARIABLES_REQUERIDAS) {
    estado[nombre] = leerEnvOpcional(nombre) !== null;
  }
  return estado;
}

/** Lista de variables requeridas que todavía no están cargadas. */
export function variablesFaltantes(): VariableRequerida[] {
  return VARIABLES_REQUERIDAS.filter((nombre) => leerEnvOpcional(nombre) === null);
}

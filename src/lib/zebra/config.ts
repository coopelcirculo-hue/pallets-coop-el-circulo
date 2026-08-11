import "server-only";

import { leerEnv, leerEnvOpcional } from "@/lib/env";

/**
 * Configuración de la impresora Zebra ZD421.
 *
 * La IP y el puerto SIEMPRE salen de variables de entorno, nunca hardcodeados.
 * La Zebra escucha ZPL crudo en el puerto 9100 (raw socket, estándar Zebra).
 *
 * La conexión real por TCP se implementa en la Etapa 5 (src/lib/zebra/imprimir.ts).
 */

export const PUERTO_ZEBRA_POR_DEFECTO = 9100;

export type ConfigZebra = {
  ip: string;
  puerto: number;
};

/** Devuelve la config de la impresora, o explota si falta ZEBRA_IP. */
export function getConfigZebra(): ConfigZebra {
  const ip = leerEnv("ZEBRA_IP");
  const puertoTexto = leerEnvOpcional("ZEBRA_PORT");
  const puerto = puertoTexto ? Number(puertoTexto) : PUERTO_ZEBRA_POR_DEFECTO;

  if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65535) {
    throw new Error(`ZEBRA_PORT inválido: "${puertoTexto}". Debe ser un puerto entre 1 y 65535.`);
  }

  return { ip, puerto };
}

/** true si la impresora está configurada (sin explotar si no lo está). */
export function zebraEstaConfigurada(): boolean {
  return leerEnvOpcional("ZEBRA_IP") !== null;
}

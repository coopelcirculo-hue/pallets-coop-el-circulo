/**
 * Tipos del modelo de datos (espejo de las tablas de Supabase).
 * Las tablas se crean en la Etapa 2 con los scripts de migración.
 */

export type Cliente = {
  id: string;
  nombre: string;
};

export type Operario = {
  id: string;
  nombre: string;
  iniciales: string;
};

export type Maquina = {
  id: string;
  nombre: string;
};

/** Estados posibles de impresión de un pallet. */
export const ESTADOS_IMPRESION = ["pendiente", "imprimiendo", "impreso", "error"] as const;
export type EstadoImpresion = (typeof ESTADOS_IMPRESION)[number];

export type Pallet = {
  id: string;
  numero_pallet: string; // ej: "P-000458"
  cliente_id: string;
  operario_id: string;
  maquina_id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  turno: string;
  peso_total: number; // suma de los kilos de productos_pallet
  observaciones: string | null;
  estado_impresion: EstadoImpresion;
  zpl_generado: string | null; // se guarda para poder reimprimir sin regenerar
  creado_en: string;
};

export type ProductoPallet = {
  id: string;
  pallet_id: string;
  medida: string; // ej: "45x60"
  micrones: number | null;
  kilos: number;
};

/** Medidas frecuentes por cliente, para los chips de autocompletado. */
export type PlantillaCliente = {
  id: string;
  cliente_id: string;
  medida: string;
  cantidad_sugerida: number | null;
};

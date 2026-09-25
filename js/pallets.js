/**
 * Consultas sobre pallets ya creados.
 *
 * Lo usan las pantallas de Historial y de Reimpresión, que preguntan casi lo
 * mismo. Está acá una sola vez para no escribirlo dos veces.
 */

window.App = window.App || {};

(function () {
  // Todo lo que hace falta para la lista: el pallet más los nombres.
  const CAMPOS_LISTA =
    "id, numero_pallet, fecha, hora, turno, peso_total, estado_impresion, creado_en," +
    " clientes(nombre), operarios(nombre, iniciales), maquinas(nombre)";

  const db = () => window.App.db;

  /**
   * Busca pallets por pedazo del número: escribiendo "458" aparece P-000458.
   * Sin texto devuelve los últimos, que es lo que se quiere ver al entrar.
   */
  async function buscar(texto, limite) {
    let consulta = db().from("pallets").select(CAMPOS_LISTA);

    const q = (texto || "").trim();
    if (q) {
      // Se busca el texto adentro del número, no solo al principio.
      consulta = consulta.ilike("numero_pallet", "%" + q + "%");
    }

    const { data, error } = await consulta
      .order("creado_en", { ascending: false })
      .limit(limite || 30);

    if (error) throw new Error(window.App.ui.mensajeDeError(error));
    return data || [];
  }

  /** Un pallet con todo: productos, formato e impresiones. */
  async function detalle(id) {
    const { data: pallet, error } = await db()
      .from("pallets")
      .select(
        "*, clientes(nombre), operarios(nombre, iniciales), maquinas(nombre)," +
          " formatos_etiqueta(id, nombre, ancho_mm, alto_mm, dpi), usuarios!pallets_creado_por_fkey(nombre)",
      )
      .eq("id", id)
      .single();

    if (error) throw new Error(window.App.ui.mensajeDeError(error));

    const [{ data: productos }, { data: impresiones }] = await Promise.all([
      db().from("productos_pallet").select("*").eq("pallet_id", id).order("orden"),
      db()
        .from("impresiones")
        .select("*")
        .eq("pallet_id", id)
        .order("creado_en", { ascending: false }),
    ]);

    return { pallet, productos: productos || [], impresiones: impresiones || [] };
  }

  /**
   * Cambia solo las observaciones. Es lo único editable de un pallet ya hecho:
   * el resto es historial de producción y no se toca.
   */
  async function guardarObservaciones(id, texto) {
    const limpio = (texto || "").trim();
    const { error } = await db()
      .from("pallets")
      .update({ observaciones: limpio === "" ? null : limpio })
      .eq("id", id);

    if (error) throw new Error(window.App.ui.mensajeDeError(error));
  }

  /** Colores del cartelito de estado, iguales en todas las pantallas. */
  const ESTILO_ESTADO = {
    pendiente: { fondo: "var(--borde)", letra: "var(--tinta-suave)", texto: "Pendiente" },
    imprimiendo: { fondo: "var(--aviso-fondo)", letra: "var(--aviso)", texto: "Imprimiendo…" },
    impreso: { fondo: "var(--ok-fondo)", letra: "var(--ok)", texto: "Impreso" },
    error: { fondo: "var(--error-fondo)", letra: "var(--error)", texto: "Error" },
  };

  window.App.pallets = { buscar, detalle, guardarObservaciones, ESTILO_ESTADO };
})();

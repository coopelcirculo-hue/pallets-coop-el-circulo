/**
 * Consultas sobre bobinas y sobre qué está haciendo cada máquina.
 */

window.App = window.App || {};

(function () {
  const db = () => window.App.db;

  const CAMPOS_LISTA =
    "id, numero_bobina, ancho_cm, micrones, kilos, turno, fecha, hora," +
    " fecha_produccion, estado_impresion, creado_en," +
    " maquinas(nombre, numero), operarios(nombre, iniciales)";

  /**
   * Las máquinas con su corrida activa: qué está produciendo cada una ahora.
   *
   * Se traen por separado y se cruzan acá en vez de con un join, porque una
   * máquina sin corrida tiene que aparecer igual en la lista (es justamente
   * la que hay que configurar).
   */
  async function maquinasConCorrida() {
    const [{ data: maquinas, error: e1 }, { data: corridas, error: e2 }] = await Promise.all([
      db().from("maquinas").select("id, nombre, numero").eq("activo", true),
      db()
        .from("corridas_maquina")
        .select("id, maquina_id, ancho_cm, micrones, iniciada_en, observaciones")
        .is("finalizada_en", null),
    ]);

    if (e1) throw new Error(window.App.ui.mensajeDeError(e1));
    if (e2) throw new Error(window.App.ui.mensajeDeError(e2));

    const porMaquina = new Map((corridas || []).map((c) => [c.maquina_id, c]));

    return (maquinas || [])
      .map((m) => ({ ...m, corrida: porMaquina.get(m.id) || null }))
      // Por número, que es como las nombran en planta. Las que no tienen, al final.
      .sort((a, b) => {
        if (a.numero === null) return 1;
        if (b.numero === null) return -1;
        return a.numero - b.numero;
      });
  }

  /** Define qué está produciendo una máquina. Cierra la corrida anterior si cambió. */
  async function definirCorrida(maquinaId, anchoCm, micrones, observaciones) {
    const { data, error } = await db().rpc("definir_corrida", {
      p_maquina_id: maquinaId,
      p_ancho_cm: anchoCm,
      p_micrones: micrones,
      p_observaciones: observaciones || null,
    });
    if (error) throw new Error(window.App.ui.mensajeDeError(error));
    return data;
  }

  /** Crea la bobina. Sin ancho ni micrones, los toma de la corrida de esa máquina. */
  async function crear({ maquinaId, operarioId, kilos, anchoCm, micrones, observaciones }) {
    const { data, error } = await db().rpc("crear_bobina", {
      p_maquina_id: maquinaId,
      p_operario_id: operarioId,
      p_kilos: kilos,
      p_ancho_cm: anchoCm === undefined ? null : anchoCm,
      p_micrones: micrones === undefined ? null : micrones,
      p_observaciones: observaciones || null,
    });
    if (error) throw new Error(window.App.ui.mensajeDeError(error));
    return data;
  }

  /** Busca por pedazo del número. Sin texto, devuelve las últimas. */
  async function buscar(texto, limite) {
    let consulta = db().from("bobinas").select(CAMPOS_LISTA);

    const q = (texto || "").trim();
    if (q) consulta = consulta.ilike("numero_bobina", "%" + q + "%");

    const { data, error } = await consulta
      .order("creado_en", { ascending: false })
      .limit(limite || 30);

    if (error) throw new Error(window.App.ui.mensajeDeError(error));
    return data || [];
  }

  /** Una bobina con todo y sus impresiones. */
  async function detalle(id) {
    const { data: bobina, error } = await db()
      .from("bobinas")
      .select(
        "*, maquinas(nombre, numero), operarios(nombre, iniciales)," +
          " usuarios!bobinas_creado_por_fkey(nombre)",
      )
      .eq("id", id)
      .single();

    if (error) throw new Error(window.App.ui.mensajeDeError(error));

    const { data: impresiones } = await db()
      .from("impresiones")
      .select("*")
      .eq("bobina_id", id)
      .order("creado_en", { ascending: false });

    return { bobina, impresiones: impresiones || [] };
  }

  /** Las bobinas de una jornada de producción (no del día del calendario). */
  async function deLaJornada(jornada) {
    const { data, error } = await db()
      .from("bobinas")
      .select(CAMPOS_LISTA)
      .eq("fecha_produccion", jornada)
      .order("creado_en", { ascending: false });

    if (error) throw new Error(window.App.ui.mensajeDeError(error));
    return data || [];
  }

  /** "45 cm · 40 µ" */
  function medida(bobinaOCorrida) {
    if (!bobinaOCorrida) return "—";
    return window.App.zplBobina.medidaLegible(
      bobinaOCorrida.ancho_cm,
      bobinaOCorrida.micrones,
    );
  }

  /** "06" a partir del número de máquina. */
  function numeroMaquina(maquina) {
    if (!maquina) return "—";
    return maquina.numero !== null && maquina.numero !== undefined
      ? String(maquina.numero).padStart(2, "0")
      : maquina.nombre;
  }

  window.App.bobinas = {
    maquinasConCorrida,
    definirCorrida,
    crear,
    buscar,
    detalle,
    deLaJornada,
    medida,
    numeroMaquina,
  };
})();

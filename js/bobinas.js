/**
 * Consultas sobre bobinas y sobre qué está haciendo cada máquina.
 */

window.App = window.App || {};

(function () {
  const db = () => window.App.db;

  const CAMPOS_LISTA =
    "id, numero_bobina, numero_en_maquina, ancho_cm, micrones, ancho_fuelle_cm," +
    " kilos, metros, aditivos_texto, turno, fecha, hora, fecha_produccion," +
    " estado_impresion, creado_en," +
    " maquinas(nombre, numero), operarios(nombre, iniciales)," +
    " materiales(nombre), colores(nombre)";

  // Todo lo que define el producto que está corriendo una máquina.
  const CAMPOS_CORRIDA =
    "id, maquina_id, ancho_cm, micrones, ancho_fuelle_cm, observaciones, iniciada_en," +
    " material_id, color_id, materiales(nombre), colores(nombre)," +
    " corridas_aditivos(id, gramos_por_kilo, aditivo_id, aditivos(nombre, tipo))";

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
      db().from("corridas_maquina").select(CAMPOS_CORRIDA).is("finalizada_en", null),
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

  /** Define qué está produciendo una máquina. Cierra la anterior si cambió algo. */
  async function definirCorrida({
    maquinaId,
    anchoCm,
    micrones,
    anchoFuelleCm,
    materialId,
    colorId,
    observaciones,
  }) {
    const { data, error } = await db().rpc("definir_corrida", {
      p_maquina_id: maquinaId,
      p_ancho_cm: anchoCm,
      p_micrones: micrones,
      p_ancho_fuelle_cm: anchoFuelleCm === undefined || anchoFuelleCm === "" ? null : anchoFuelleCm,
      p_material_id: materialId || null,
      p_color_id: colorId || null,
      p_observaciones: observaciones || null,
    });
    if (error) throw new Error(window.App.ui.mensajeDeError(error));
    return data;
  }

  /** Reemplaza la lista completa de aditivos de una corrida. */
  async function definirAditivos(corridaId, lista) {
    const { data, error } = await db().rpc("definir_aditivos_corrida", {
      p_corrida_id: corridaId,
      p_aditivos: (lista || []).map((a) => ({
        aditivo_id: a.aditivoId,
        gramos_por_kilo: a.gramosPorKilo,
      })),
    });
    if (error) throw new Error(window.App.ui.mensajeDeError(error));
    return data;
  }

  /** Crea la bobina. La medida y el detalle salen de la corrida de esa máquina. */
  async function crear({ maquinaId, operarioId, kilos, metros, observaciones }) {
    const { data, error } = await db().rpc("crear_bobina", {
      p_maquina_id: maquinaId,
      p_operario_id: operarioId,
      p_kilos: kilos,
      p_metros: metros === undefined || metros === "" ? null : metros,
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
          " materiales(nombre), colores(nombre)," +
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

  /** Los catálogos que se eligen al definir una corrida. */
  async function catalogos() {
    const [materiales, colores, aditivos] = await Promise.all([
      db().from("materiales").select("id, nombre").eq("activo", true).order("nombre"),
      db().from("colores").select("id, nombre").eq("activo", true).order("nombre"),
      db().from("aditivos").select("id, nombre, tipo").eq("activo", true).order("nombre"),
    ]);

    const fallo = [materiales, colores, aditivos].find((r) => r.error);
    if (fallo) throw new Error(window.App.ui.mensajeDeError(fallo.error));

    return {
      materiales: materiales.data || [],
      colores: colores.data || [],
      aditivos: aditivos.data || [],
    };
  }

  /* --- Textos para pantalla ------------------------------------------- */

  /** "45 cm · fuelle 8 · 40 µ" (el fuelle solo si lleva). */
  function medida(x) {
    if (!x) return "—";
    const k = window.App.zpl.kilosLegibles;
    const partes = [`${k(x.ancho_cm)} cm`];
    if (x.ancho_fuelle_cm) partes.push(`fuelle ${k(x.ancho_fuelle_cm)}`);
    partes.push(`${k(x.micrones)} µ`);
    return partes.join(" · ");
  }

  /** "BD · Transparente", con lo que haya. */
  function materialYColor(x) {
    if (!x) return "";
    const partes = [];
    if (x.materiales && x.materiales.nombre) partes.push(x.materiales.nombre);
    if (x.colores && x.colores.nombre) partes.push(x.colores.nombre);
    return partes.join(" · ");
  }

  /** "Master de color 20 g/kg · UV 10 g/kg" desde una corrida ya cargada. */
  function aditivosDeCorrida(corrida) {
    if (!corrida || !corrida.corridas_aditivos || corrida.corridas_aditivos.length === 0) {
      return "";
    }
    const k = window.App.zpl.kilosLegibles;
    return corrida.corridas_aditivos
      .map((ca) => `${ca.aditivos ? ca.aditivos.nombre : "?"} ${k(ca.gramos_por_kilo)} g/kg`)
      .sort()
      .join(" · ");
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
    definirAditivos,
    crear,
    buscar,
    detalle,
    deLaJornada,
    catalogos,
    medida,
    materialYColor,
    aditivosDeCorrida,
    numeroMaquina,
  };
})();

/**
 * Envío de la etiqueta a la Zebra y manejo de los estados de impresión.
 *
 * Hay DOS caminos de salida para el mismo ZPL:
 *
 *   1. Zebra Browser Print: la app corre en la tablet y la página le habla
 *      por localhost. Un toque y sale. Es el camino ideal.
 *
 *   2. Descargar el archivo .zpl: Android lo abre con Zebra Print Connect y
 *      lo manda a la impresora. Un toque más, pero NO pasa por localhost, así
 *      que ninguna política del navegador lo puede romper.
 *
 * El camino 2 existe porque Chrome (y ahora también Firefox) están cerrando
 * el acceso de los sitios públicos a localhost. Si Browser Print no responde,
 * el sistema no se queda sin imprimir.
 *
 * Pase lo que pase, el pallet YA está guardado antes de intentar imprimir:
 * un problema de impresión nunca hace perder el registro.
 */

window.App = window.App || {};

(function () {
  // Browser Print escucha en estos puertos. El 9100 es HTTP y el 9101 HTTPS.
  const PUERTOS = ["http://localhost:9100"];

  const INTENTOS = 3;
  const ESPERA_MS = 3000;

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  /** fetch con límite de tiempo, para no quedarse colgado si no hay nadie. */
  async function traer(url, opciones = {}, milisegundos) {
  const cancelador = new AbortController();
  const reloj = setTimeout(() => cancelador.abort(), milisegundos || 5000);

  try {
    return await fetch(url, {
      ...opciones,
      signal: cancelador.signal,
      targetAddressSpace: "loopback"
    });
    } finally {
    clearTimeout(reloj);
  }
}

  /*
    Memoria de si Browser Print está o no.
  /*

    Importa para el uso diario: si la app no está instalada, cada consulta
    tarda un par de segundos en darse por vencida. Sin esta memoria, cada
    pallet haría esperar al encargado al pedo antes de ofrecerle la descarga.
    null = todavía no se averiguó · false = no está · objeto = está.
  */
  let memoria = null;

  /** Olvida lo averiguado, para cuando el operario toca "Reintentar". */
  function olvidarDeteccion() {
    memoria = null;
  }

  /**
   * Busca la impresora configurada en Browser Print.
   * Devuelve { base, dispositivo } o null si Browser Print no está.
   */
  async function buscarImpresora() {
    if (memoria !== null) return memoria;
    memoria = await detectar();
    return memoria;
  }

  /*
    Qué pasó con cada puerto en el último intento. Sirve para el diagnóstico:
    "no responde" puede ser que Browser Print no esté, o que esté y Chrome le
    corte la comunicación por el certificado. Son problemas distintos con
    soluciones distintas, y antes se veían igual.
  */
  let intentos = [];

  function ultimosIntentos() {
    return intentos.slice();
  }

  async function detectar() {
    intentos = [];
    for (const base of PUERTOS) {
      try {
        const r = await traer(base + "/default?type=printer", { method: "GET" }, 2500);

        if (!r.ok) {
          intentos.push({ base, estado: "respondió " + r.status });
          continue;
        }

        const texto = (await r.text()).trim();
        if (!texto) {
          intentos.push({ base, estado: "contesta, pero sin impresora predeterminada" });
          continue;
        }

        // Según la versión devuelve JSON o el nombre pelado.
        let dispositivo;
        try {
          dispositivo = JSON.parse(texto);
        } catch {
          dispositivo = { name: texto, deviceType: "printer", connection: "network" };
        }

        intentos.push({ base, estado: "OK", ok: true });
        return { base, dispositivo };
      } catch (e) {
        intentos.push({
          base,
          estado: e.name === "AbortError" ? "no contestó a tiempo" : "no se pudo conectar",
        });
      }
    }
    return null;
  }

  /**
   * Lista TODO lo que Browser Print tiene configurado, sea por red o por
   * Bluetooth. Sirve para el diagnóstico: si la impresora aparece acá, el
   * puente funciona y solo falta marcarla como predeterminada.
   */
  async function listarImpresoras() {
    for (const base of PUERTOS) {
      try {
        const r = await traer(base + "/available", { method: "GET" }, 3000);
        if (!r.ok) continue;

        const texto = (await r.text()).trim();
        if (!texto) continue;

        const datos = JSON.parse(texto);
        // Según la versión devuelve un array o un objeto con la lista adentro.
        const lista = Array.isArray(datos)
          ? datos
          : [].concat(datos.printer || [], datos.device || [], datos.printers || []);

        return lista.filter(Boolean);
      } catch {
        // Ese puerto no contesta o no devolvió algo entendible.
      }
    }
    return null;
  }

  /** Manda el ZPL por Browser Print. Tira error si no se pudo. */
  async function enviarPorBrowserPrint(zpl) {
    const encontrada = await buscarImpresora();
    if (!encontrada) {
      const e = new Error("Browser Print no está disponible en este dispositivo.");
      e.sinBrowserPrint = true; // no tiene sentido reintentar
      throw e;
    }

    const r = await traer(
      encontrada.base + "/write",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ device: encontrada.dispositivo, data: zpl }),
      },
      6000,
    );

    if (!r.ok) {
      throw new Error("Browser Print rechazó el trabajo (HTTP " + r.status + ").");
    }

    return encontrada.dispositivo.name || "Browser Print";
  }

  /** Baja el ZPL como archivo, para abrirlo con Print Connect. */
  function descargarZpl(zpl, numeroPallet) {
    const blob = new Blob([zpl], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (numeroPallet || "etiqueta") + ".zpl";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Se libera después, para que el navegador alcance a empezar la descarga.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* =====================================================================
     Modo de impresión de ESTE dispositivo.

     Va en la tablet y no en la base a propósito: depende de si en este
     equipo anda Browser Print, no de la fábrica. Una tablet puede imprimir
     sola y otra bajar el archivo, sin pisarse.
     ===================================================================== */

  const CLAVE_MODO = "pallets_modo_impresion";

  /** "browser_print" (automático) o "descarga" (bajar el .zpl a mano). */
  function modoImpresion() {
    try {
      return localStorage.getItem(CLAVE_MODO) === "descarga" ? "descarga" : "browser_print";
    } catch {
      return "browser_print";
    }
  }

  function setModoImpresion(modo) {
    try {
      localStorage.setItem(CLAVE_MODO, modo === "descarga" ? "descarga" : "browser_print");
    } catch {
      // Si el navegador no deja guardar, queda en automático.
    }
  }

  /** Descripción corta del equipo, para el registro de impresiones. */
  function nombreDispositivo() {
    const guardado = localStorage.getItem("pallets_nombre_dispositivo");
    if (guardado) return guardado;

    const ua = navigator.userAgent;
    const sistema = /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad/i.test(ua)
        ? "iOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : "Otro";
    return sistema;
  }

  /** Deja registro del intento. Nunca frena la impresión si falla. */
  async function registrar(palletId, resultado, detalle, esReimpresion) {
    try {
      await window.App.db.from("impresiones").insert({
        pallet_id: palletId,
        resultado,
        detalle: detalle ? String(detalle).slice(0, 500) : null,
        dispositivo: nombreDispositivo(),
        es_reimpresion: !!esReimpresion,
      });
    } catch (e) {
      console.warn("No se pudo registrar la impresión:", e);
    }
  }

  async function cambiarEstado(palletId, estado, zpl) {
    const cambios = { estado_impresion: estado };
    if (zpl) cambios.zpl_generado = zpl;
    await window.App.db.from("pallets").update(cambios).eq("id", palletId);
  }

  /**
   * Trae todo lo necesario para armar la etiqueta de un pallet.
   * Se usa tanto al crear como al reimprimir.
   */
  async function datosParaEtiqueta(palletId) {
    const db = window.App.db;

    const { data: pallet, error } = await db
      .from("pallets")
      .select(
        "*, clientes(nombre), operarios(nombre, iniciales), maquinas(nombre), formatos_etiqueta(*)",
      )
      .eq("id", palletId)
      .single();

    if (error) throw new Error(window.App.ui.mensajeDeError(error));

    const [{ data: productos }, { data: config }] = await Promise.all([
      db.from("productos_pallet").select("*").eq("pallet_id", palletId).order("orden"),
      db.from("configuracion").select("*").eq("id", 1).maybeSingle(),
    ]);

    // Si el pallet no tiene formato asignado, se usa el predeterminado.
    let formato = pallet.formatos_etiqueta;
    if (!formato) {
      const { data } = await db
        .from("formatos_etiqueta")
        .select("*")
        .eq("predeterminado", true)
        .maybeSingle();
      formato = data;
    }

    if (!formato) {
      throw new Error("No hay ningún formato de etiqueta cargado. Andá a Configuración.");
    }

    // El dpi es del cabezal de la impresora, no de la etiqueta: sale de la
    // configuración general y se le pega al formato para armar el ZPL.
    formato = { ...formato, dpi: (config && config.impresora_dpi) || 203 };

    const datos = window.App.zpl.datosDeEtiqueta(pallet, productos, config, {
      cliente: pallet.clientes && pallet.clientes.nombre,
      // En la etiqueta va la inicial del operario, que es lo que usan en planta.
      operario: pallet.operarios && (pallet.operarios.iniciales || pallet.operarios.nombre),
      maquina: pallet.maquinas && pallet.maquinas.nombre,
    });

    return { pallet, productos, formato, datos };
  }

  /**
   * Imprime un pallet de punta a punta: arma el ZPL, lo guarda, intenta
   * mandarlo con reintentos y deja todo registrado.
   *
   * Devuelve { ok, zpl, disenio, mensaje, impresora }.
   * Si ok es false, el ZPL igual queda listo para descargarlo a mano.
   */
  async function imprimirPallet(palletId, opciones) {
    const config = opciones || {};
    const esReimpresion = !!config.esReimpresion;

    const { pallet, formato, datos } = await datosParaEtiqueta(palletId);

    // En una reimpresión se reusa el ZPL guardado: la etiqueta tiene que salir
    // idéntica a la original, aunque desde entonces hayan cambiado la marca o
    // las medidas del formato.
    let zpl, disenio;
    if (esReimpresion && pallet.zpl_generado) {
      zpl = pallet.zpl_generado;
      disenio = window.App.zpl.calcularDisenio(datos, formato);
    } else {
      const generado = window.App.zpl.generar(datos, formato);
      zpl = generado.zpl;
      disenio = generado.disenio;
    }

    await cambiarEstado(palletId, "imprimiendo", zpl);

    if (config.reintentarDeteccion) olvidarDeteccion();

    let ultimoError = null;
    for (let intento = 1; intento <= INTENTOS; intento++) {
      try {
        const impresora = await enviarPorBrowserPrint(zpl);
        await cambiarEstado(palletId, "impreso");
        await registrar(palletId, "ok", "Enviado a " + impresora, esReimpresion);
        return { ok: true, zpl, disenio, impresora };
      } catch (e) {
        ultimoError = e;

        // Si Browser Print no está instalado, insistir no arregla nada y solo
        // haría esperar al encargado. Se pasa derecho a ofrecer la descarga.
        if (e.sinBrowserPrint) break;

        if (intento < INTENTOS) await dormir(ESPERA_MS);
      }
    }

    const mensaje = ultimoError ? ultimoError.message : "No se pudo imprimir.";
    await cambiarEstado(palletId, "error");
    await registrar(palletId, "error", mensaje, esReimpresion);

    return { ok: false, zpl, disenio, mensaje };
  }

  /* =====================================================================
     Bobinas

     La maquinaria de mandar, reintentar y registrar es la misma que la de
     los pallets; lo único distinto es de dónde salen los datos y cómo se
     arma la etiqueta.
     ===================================================================== */

  /** Cambia el estado de impresión de una bobina. */
  async function cambiarEstadoBobina(bobinaId, estado, zpl) {
    const cambios = { estado_impresion: estado };
    if (zpl) cambios.zpl_generado = zpl;
    await window.App.db.from("bobinas").update(cambios).eq("id", bobinaId);
  }

  async function registrarBobina(bobinaId, resultado, detalle, esReimpresion) {
    try {
      await window.App.db.from("impresiones").insert({
        bobina_id: bobinaId,
        resultado,
        detalle: detalle ? String(detalle).slice(0, 500) : null,
        dispositivo: nombreDispositivo(),
        es_reimpresion: !!esReimpresion,
      });
    } catch (e) {
      console.warn("No se pudo registrar la impresión:", e);
    }
  }

  /** Trae todo lo necesario para armar la etiqueta de una bobina. */
  async function datosParaEtiquetaBobina(bobinaId) {
    const db = window.App.db;

    const { data: bobina, error } = await db
      .from("bobinas")
      .select(
        "*, maquinas(nombre, numero), operarios(nombre, iniciales)," +
          " materiales(nombre), colores(nombre)",
      )
      .eq("id", bobinaId)
      .single();

    if (error) throw new Error(window.App.ui.mensajeDeError(error));

    const [{ data: config }, { data: formato }] = await Promise.all([
      db.from("configuracion").select("*").eq("id", 1).maybeSingle(),
      db
        .from("formatos_etiqueta")
        .select("*")
        .eq("predeterminado", true)
        .maybeSingle(),
    ]);

    if (!formato) {
      throw new Error("No hay ningún formato de etiqueta cargado. Andá a Configuración.");
    }

    const conDpi = { ...formato, dpi: (config && config.impresora_dpi) || 203 };

    const datos = window.App.zplBobina.datosDeBobina(bobina, config, {
      // En la etiqueta va el número de máquina, que es como la nombran en planta.
      maquina:
        bobina.maquinas && bobina.maquinas.numero !== null
          ? String(bobina.maquinas.numero).padStart(2, "0")
          : (bobina.maquinas && bobina.maquinas.nombre) || "",
      operario: bobina.operarios && (bobina.operarios.iniciales || bobina.operarios.nombre),
    });

    return { bobina, formato: conDpi, datos };
  }

  /** Imprime una bobina de punta a punta. Misma lógica que los pallets. */
  async function imprimirBobina(bobinaId, opciones) {
    const config = opciones || {};
    const esReimpresion = !!config.esReimpresion;

    const { bobina, formato, datos } = await datosParaEtiquetaBobina(bobinaId);

    // Al reimprimir se reusa el ZPL guardado: la etiqueta tiene que salir
    // igual a la original, aunque hoy la corrida de esa máquina sea otra.
    let zpl, disenio;
    if (esReimpresion && bobina.zpl_generado) {
      zpl = bobina.zpl_generado;
      disenio = window.App.zplBobina.mejorDisenio(datos, formato);
    } else {
      const generado = window.App.zplBobina.generar(datos, formato);
      zpl = generado.zpl;
      disenio = generado.disenio;
    }

    await cambiarEstadoBobina(bobinaId, "imprimiendo", zpl);

    /*
      Modo descarga: ni se intenta Browser Print. Se baja el archivo y listo.
      Sin esto, cada bobina esperaba unos segundos a que Browser Print se
      diera por vencido y quedaba marcada con error, llenando de alertas el
      Inicio por algo que en realidad se imprimió bien con Print Connect.
    */
    if (modoImpresion() === "descarga") {
      descargarZpl(zpl, bobina.numero_bobina);
      await cambiarEstadoBobina(bobinaId, "impreso");
      await registrarBobina(
        bobinaId,
        "ok",
        "Archivo descargado para imprimir con Print Connect",
        esReimpresion,
      );
      return { ok: true, zpl, disenio, descargado: true };
    }

    if (config.reintentarDeteccion) olvidarDeteccion();

    let ultimoError = null;
    for (let intento = 1; intento <= INTENTOS; intento++) {
      try {
        const impresora = await enviarPorBrowserPrint(zpl);
        await cambiarEstadoBobina(bobinaId, "impreso");
        await registrarBobina(bobinaId, "ok", "Enviado a " + impresora, esReimpresion);
        return { ok: true, zpl, disenio, impresora };
      } catch (e) {
        ultimoError = e;
        if (e.sinBrowserPrint) break;
        if (intento < INTENTOS) await dormir(ESPERA_MS);
      }
    }

    const mensaje = ultimoError ? ultimoError.message : "No se pudo imprimir.";
    await cambiarEstadoBobina(bobinaId, "error");
    await registrarBobina(bobinaId, "error", mensaje, esReimpresion);

    return { ok: false, zpl, disenio, mensaje };
  }

  window.App.impresora = {
    PUERTOS,
    modoImpresion,
    setModoImpresion,
    buscarImpresora,
    listarImpresoras,
    ultimosIntentos,
    olvidarDeteccion,
    datosParaEtiquetaBobina,
    imprimirBobina,
    enviarPorBrowserPrint,
    descargarZpl,
    datosParaEtiqueta,
    imprimirPallet,
    nombreDispositivo,
  };
})();

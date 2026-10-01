/**
 * Generación de la etiqueta.
 *
 * La idea clave de este archivo: el diseño se calcula UNA sola vez, en
 * milímetros, y de ese mismo cálculo salen las dos cosas:
 *
 *   - el ZPL que se manda a la Zebra
 *   - la vista previa que se dibuja en pantalla
 *
 * Así la vista previa no puede mentir: si en pantalla el contenido no entra,
 * en la etiqueta tampoco.
 *
 * Todas las medidas del diseño están en MILÍMETROS, que es lo que se puede
 * medir con una regla contra la etiqueta real. La conversión a puntos se hace
 * al final, según el dpi del cabezal.
 */

window.App = window.App || {};

(function () {
  /* ---------------------------------------------------------------------
     Medidas del diseño, en milímetros.
     Tocar estos números cambia la etiqueta. Están arriba a propósito.
     --------------------------------------------------------------------- */
  const D = {
    margen: 4,

    alturaMarca: 6,
    alturaEtiquetaNumero: 3.5, // el texto "PALLET Nº"
    alturaNumero: 13, // el P-000458 grande
    alturaDato: 4, // Cliente, Operario, Máquina...
    alturaContenido: 4, // las líneas de medidas y kilos
    alturaPesoTotal: 7,
    alturaPie: 3,

    interlineadoDato: 5.5,
    interlineadoContenido: 5.5,

    espacioChico: 2,
    espacioMedio: 3,

    grosorLinea: 0.4,

    // Dónde arranca el valor de "Cliente:", "Operario:", etc.
    sangriaValor: 22,
  };

  /** Milímetros a puntos de impresión, según la resolución del cabezal. */
  function mmAPuntos(mm, dpi) {
    return Math.round((mm * dpi) / 25.4);
  }

  /**
   * Ancho aproximado de un texto, en milímetros.
   *
   * La fuente escalable de la Zebra (font 0) tiene los caracteres más o menos
   * a 0,6 de su altura. Es una estimación: se prefiere errar por exceso, que
   * achica el texto de más, antes que por defecto, que lo deja cortado.
   */
  function anchoEstimado(texto, altura) {
    return String(texto).length * altura * 0.6;
  }

  /**
   * Devuelve la altura de letra más grande con la que el texto entra en el
   * ancho disponible.
   *
   * Hace falta porque la etiqueta tiene un ancho fijo y los datos no: una
   * medida con fuelle ("45 cm · F 11.5 · 14 µ") es mucho más larga que una
   * sin él, y sin esto el final se imprime cortado.
   */
  function alturaQueEntra(texto, alturaDeseada, anchoDisponible, alturaMinima) {
    const estimado = anchoEstimado(texto, alturaDeseada);
    if (estimado <= anchoDisponible) return alturaDeseada;
    const ajustada = (alturaDeseada * anchoDisponible) / estimado;
    return Math.max(alturaMinima || 2.5, ajustada);
  }

  /** "2026-07-24" → "24/07/2026" */
  function fechaLegible(fecha) {
    if (!fecha) return "";
    const [a, m, d] = String(fecha).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }

  /** "09:42:11" → "09:42" */
  function horaLegible(hora) {
    return hora ? String(hora).slice(0, 5) : "";
  }

  /** Números lindos: 440 en vez de 440.00, pero 440.5 si hace falta. */
  function kilosLegibles(valor) {
    const n = Number(valor) || 0;
    return (Number.isInteger(n) ? n : Number(n.toFixed(2))).toString();
  }

  /* ---------------------------------------------------------------------
     Cálculo del diseño
     --------------------------------------------------------------------- */

  /**
   * Arma la lista de elementos de la etiqueta con sus posiciones.
   *
   * datos = {
   *   marcaPrincipal, marcaSecundaria, numeroPallet, cliente, operario,
   *   maquina, fecha, hora, productos: [{medida, kilos}], pesoTotal
   * }
   * formato = { ancho_mm, alto_mm, dpi }
   */
  function calcularDisenio(datos, formato) {
    const ancho = Number(formato.ancho_mm);
    const alto = Number(formato.alto_mm);
    const util = ancho - D.margen * 2;

    const elementos = [];
    let y = D.margen;

    const texto = (contenido, opciones) => {
      if (contenido === "" || contenido === null || contenido === undefined) return;
      elementos.push({
        tipo: "texto",
        x: opciones.x !== undefined ? opciones.x : D.margen,
        y,
        altura: opciones.altura,
        texto: String(contenido),
        negrita: !!opciones.negrita,
        alineacion: opciones.alineacion || "izq",
        ancho: opciones.ancho !== undefined ? opciones.ancho : util,
      });
    };

    const linea = () => {
      elementos.push({ tipo: "linea", x: D.margen, y, ancho: util, grosor: D.grosorLinea });
      y += D.espacioMedio;
    };

    // --- Marca de la fábrica ---
    texto(datos.marcaPrincipal, { altura: D.alturaMarca, negrita: true });
    y += D.alturaMarca + D.espacioChico;
    linea();

    // --- Número de pallet, lo más grande de la etiqueta ---
    texto("PALLET Nº", { altura: D.alturaEtiquetaNumero });
    y += D.alturaEtiquetaNumero + 1;

    texto(datos.numeroPallet, { altura: D.alturaNumero, negrita: true });
    y += D.alturaNumero + D.espacioMedio;
    linea();

    // --- Datos del pallet ---
    const filas = [
      ["Cliente:", datos.cliente],
      ["Operario:", datos.operario],
      ["Máquina:", datos.maquina],
      ["Fecha:", fechaLegible(datos.fecha)],
      ["Hora:", horaLegible(datos.hora)],
    ];

    filas.forEach(([rotulo, valor]) => {
      texto(rotulo, { altura: D.alturaDato });
      texto(valor, { altura: D.alturaDato, x: D.margen + D.sangriaValor });
      y += D.interlineadoDato;
    });

    y += D.espacioChico;
    linea();

    // --- Contenido ---
    texto("Contenido:", { altura: D.alturaDato });
    y += D.interlineadoContenido;

    (datos.productos || []).forEach((p) => {
      texto(p.medida, { altura: D.alturaContenido });
      texto(kilosLegibles(p.kilos) + " kg", {
        altura: D.alturaContenido,
        alineacion: "der",
      });
      y += D.interlineadoContenido;
    });

    y += D.espacioChico;
    linea();

    // --- Peso total ---
    texto("PESO TOTAL: " + kilosLegibles(datos.pesoTotal) + " kg", {
      altura: D.alturaPesoTotal,
      negrita: true,
    });
    y += D.alturaPesoTotal + D.espacioChico;

    // --- Pie con la marca del sistema ---
    if (datos.marcaSecundaria) {
      texto(datos.marcaSecundaria, { altura: D.alturaPie });
      y += D.alturaPie;
    }

    const altoUsado = y + D.margen;

    return {
      ancho,
      alto,
      dpi: Number(formato.dpi) || 203,
      elementos,
      altoUsado,
      // Si esto da false, el contenido se va a cortar en la etiqueta real.
      entra: altoUsado <= alto,
    };
  }

  /* ---------------------------------------------------------------------
     De diseño a ZPL
     --------------------------------------------------------------------- */

  /**
   * Convierte el diseño en comandos ZPL.
   *
   * Comandos que se usan:
   *   ^XA / ^XZ  abre y cierra la etiqueta
   *   ^CI28      codificación UTF-8 — sin esto "Máquina" sale con basura
   *   ^PW / ^LL  ancho y largo de la etiqueta, en puntos
   *   ^LH0,0     origen arriba a la izquierda
   *   ^FO x,y    posición del campo
   *   ^A0N,h,w   fuente escalable; w en 0 la deja proporcional
   *   ^FB w,1,0,a bloque de ancho w con alineación (L o R)
   *   ^GB w,h,t  recuadro; con alto 0 sale una línea horizontal
   *   ^FD ... ^FS  el dato y el cierre del campo
   */
  function aZpl(disenio) {
    const dpi = disenio.dpi;
    const p = (mm) => mmAPuntos(mm, dpi);

    const l = [];
    l.push("^XA");
    l.push("^CI28"); // UTF-8: imprescindible para los acentos y la Ñ
    l.push("^LH0,0");
    l.push("^PW" + p(disenio.ancho));
    l.push("^LL" + p(disenio.alto));

    disenio.elementos.forEach((e) => {
      if (e.tipo === "linea") {
        l.push(`^FO${p(e.x)},${p(e.y)}^GB${p(e.ancho)},0,${Math.max(1, p(e.grosor))}^FS`);
        return;
      }

      const x = p(e.x);
      const y = p(e.y);
      const alto = p(e.altura);
      const fuente = `^A0N,${alto},0`;
      const dato = escapar(e.texto);

      // La alineación a la derecha necesita un bloque (^FB) con su ancho.
      const bloque = e.alineacion === "der" ? `^FB${p(e.ancho)},1,0,R` : "";

      l.push(`^FO${x},${y}${fuente}${bloque}^FD${dato}^FS`);

      // ZPL no tiene negrita en las fuentes escalables. El truco estándar es
      // imprimir el mismo texto corrido un punto: engorda el trazo.
      if (e.negrita) {
        l.push(`^FO${x + 1},${y}${fuente}${bloque}^FD${dato}^FS`);
      }
    });

    l.push("^XZ");
    return l.join("\n");
  }

  /**
   * Los caracteres ^ ~ y \ son de control en ZPL: si vienen adentro de un
   * nombre de cliente cortarían la etiqueta al medio. Se neutralizan.
   */
  function escapar(texto) {
    return String(texto).replace(/\\/g, "\\\\").replace(/\^/g, " ").replace(/~/g, " ");
  }

  /* ---------------------------------------------------------------------
     Armado de los datos desde lo que devuelve Supabase
     --------------------------------------------------------------------- */

  /** Junta el pallet, sus productos y la configuración en lo que espera el diseño. */
  function datosDeEtiqueta(pallet, productos, config, nombres) {
    return {
      marcaPrincipal: (config && config.marca_principal) || "",
      marcaSecundaria: (config && config.marca_secundaria) || "",
      numeroPallet: pallet.numero_pallet,
      cliente: nombres.cliente || "",
      operario: nombres.operario || "",
      maquina: nombres.maquina || "",
      fecha: pallet.fecha,
      hora: pallet.hora,
      productos: (productos || []).map((p) => ({ medida: p.medida, kilos: p.kilos })),
      pesoTotal: pallet.peso_total,
    };
  }

  window.App.zpl = {
    D,
    mmAPuntos,
    anchoEstimado,
    alturaQueEntra,
    calcularDisenio,
    aZpl,
    datosDeEtiqueta,
    fechaLegible,
    horaLegible,
    kilosLegibles,
    /** Atajo: de los datos crudos al ZPL listo para mandar. */
    generar(datos, formato) {
      const disenio = calcularDisenio(datos, formato);
      return { zpl: aZpl(disenio), disenio };
    },
  };
})();

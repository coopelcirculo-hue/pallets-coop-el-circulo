/**
 * Etiqueta de bobina.
 *
 * Reutiliza el motor de js/zpl.js: acá solo se calcula la posición de cada
 * cosa en milímetros, y de ese mismo cálculo salen el ZPL y la vista previa.
 *
 * Prioridad visual, pensada para alguien mirando una pila de bobinas en el
 * depósito: primero la MEDIDA (que es el dato fundamental), después el PESO,
 * después el número. Lo demás va compacto.
 */

window.App = window.App || {};

(function () {
  /* ---------------------------------------------------------------------
     Medidas del diseño, en milímetros. Tocar acá cambia la etiqueta.
     --------------------------------------------------------------------- */
  const D = {
    margen: 4,

    alturaMarca: 5,
    alturaRotulo: 3.2, // los textos chicos tipo "MEDIDA"
    alturaMedida: 11, // el dato fundamental
    alturaNumero: 9, // B-001234
    alturaDatos: 4.2, // la línea de máquina / operario / turno
    alturaFecha: 3.8,
    alturaPeso: 9,
    alturaPie: 2.8,

    espacioChico: 1.5,
    espacioMedio: 2.5,
    grosorLinea: 0.4,
  };

  /** "45 cm · 40 µ" a partir del ancho y los micrones. */
  function medidaLegible(anchoCm, micrones) {
    const k = window.App.zpl.kilosLegibles;
    return `${k(anchoCm)} cm  ·  ${k(micrones)} µ`;
  }

  /**
   * datos = {
   *   marcaPrincipal, marcaSecundaria, numeroBobina, anchoCm, micrones,
   *   kilos, maquina (número), operario (iniciales), turno, fecha, hora
   * }
   * formato = { ancho_mm, alto_mm, dpi }
   */
  function calcularDisenioBobina(datos, formato) {
    const zpl = window.App.zpl;
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

    // --- La medida: el dato más importante de la etiqueta ---
    texto("MEDIDA", { altura: D.alturaRotulo });
    y += D.alturaRotulo + D.espacioChico;
    texto(medidaLegible(datos.anchoCm, datos.micrones), {
      altura: D.alturaMedida,
      negrita: true,
    });
    y += D.alturaMedida + D.espacioMedio;
    linea();

    // --- Número de bobina ---
    texto("BOBINA Nº", { altura: D.alturaRotulo });
    y += D.alturaRotulo + D.espacioChico;
    texto(datos.numeroBobina, { altura: D.alturaNumero, negrita: true });
    y += D.alturaNumero + D.espacioMedio;
    linea();

    // --- Máquina, operario y turno en una sola línea, para no estirar ---
    texto(`MÁQ ${datos.maquina}`, { altura: D.alturaDatos, negrita: true });
    texto(`OP ${datos.operario}`, {
      altura: D.alturaDatos,
      x: D.margen + util * 0.36,
      negrita: true,
    });
    texto(String(datos.turno || "").toUpperCase(), {
      altura: D.alturaDatos,
      alineacion: "der",
      negrita: true,
    });
    y += D.alturaDatos + D.espacioChico;

    texto(
      `${zpl.fechaLegible(datos.fecha)}   ${zpl.horaLegible(datos.hora)}`,
      { altura: D.alturaFecha },
    );
    y += D.alturaFecha + D.espacioMedio;
    linea();

    // --- Peso ---
    texto(`PESO: ${zpl.kilosLegibles(datos.kilos)} kg`, {
      altura: D.alturaPeso,
      negrita: true,
    });
    y += D.alturaPeso + D.espacioChico;

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
      entra: altoUsado <= alto,
    };
  }

  /** Arma los datos de la etiqueta desde lo que devuelve Supabase. */
  function datosDeBobina(bobina, config, nombres) {
    return {
      marcaPrincipal: (config && config.marca_principal) || "",
      marcaSecundaria: (config && config.marca_secundaria) || "",
      numeroBobina: bobina.numero_bobina,
      anchoCm: bobina.ancho_cm,
      micrones: bobina.micrones,
      kilos: bobina.kilos,
      maquina: nombres.maquina || "",
      operario: nombres.operario || "",
      turno: bobina.turno,
      fecha: bobina.fecha,
      hora: bobina.hora,
    };
  }

  window.App.zplBobina = {
    D,
    medidaLegible,
    calcularDisenioBobina,
    datosDeBobina,
    /** De los datos crudos al ZPL listo para mandar. */
    generar(datos, formato) {
      const disenio = calcularDisenioBobina(datos, formato);
      // El motor de ZPL es el mismo que el de los pallets.
      return { zpl: window.App.zpl.aZpl(disenio), disenio };
    },
  };
})();

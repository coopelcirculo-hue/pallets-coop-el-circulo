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
    alturaMaterial: 5, // material y color, debajo de la medida
    alturaNumero: 9, // 06-00123
    alturaDatos: 4.2, // la línea de máquina / operario / turno
    alturaFecha: 3.8,
    alturaPeso: 9,
    alturaMetros: 6,
    alturaPie: 2.8,

    espacioChico: 1.5,
    espacioMedio: 2.5,
    grosorLinea: 0.4,
  };

  /**
   * "45 cm · 14 µ" — el renglón grande de la etiqueta.
   *
   * El fuelle NO va acá a propósito: metiéndolo, el texto se hacía tan largo
   * que había que achicarlo hasta quedar más chico que el número de bobina, y
   * la medida es el dato más importante de la etiqueta. Va en su propio
   * renglón, abajo.
   */
  function medidaLegible(anchoCm, micrones) {
    const k = window.App.zpl.kilosLegibles;
    return `${k(anchoCm)} cm · ${k(micrones)} µ`;
  }

  /*
    Tres niveles de detalle.

    Las etiquetas de bobina suelen ser mucho más chicas que las de pallet, y
    no hay un tamaño único: cada planta usa el rollo que consigue. En vez de
    imprimir una etiqueta cortada, el diseño baja de nivel hasta entrar.

    Lo que se sacrifica primero es lo prescindible (la marca, el pie, la
    fecha); lo último que se saca son los cuatro datos que hacen que la
    bobina sirva: número, medida, peso y de qué máquina salió.
  */
  const COMPLETA = 0; // todo
  const MEDIA = 1; // sin marca ni pie
  const MINIMA = 2; // solo lo imprescindible, sin rótulos ni líneas

  /**
   * datos = {
   *   marcaPrincipal, marcaSecundaria, numeroBobina, anchoCm, micrones,
   *   anchoFuelleCm, material, color, kilos, metros,
   *   maquina (número), operario (iniciales), turno, fecha, hora
   * }
   * formato = { ancho_mm, alto_mm, dpi }
   */
  function calcularDisenioBobina(datos, formato, nivel, escala) {
    const zpl = window.App.zpl;
    const detalle = nivel === undefined ? COMPLETA : nivel;
    const e = escala || 1;
    const ancho = Number(formato.ancho_mm);
    const alto = Number(formato.alto_mm);

    /*
      Todas las alturas y espacios se multiplican por la escala. Sacar
      elementos no alcanza: en una etiqueta de 50 mm, un número de bobina de
      9 mm de alto se come una quinta parte del papel él solo.
    */
    const T = {};
    Object.keys(D).forEach((k) => (T[k] = D[k] * e));

    // El margen y el grosor de línea tienen piso: por debajo, la impresora
    // térmica no los resuelve bien.
    const margen = Math.max(1.5, (ancho < 60 ? 2 : D.margen) * e);
    T.grosorLinea = Math.max(0.3, D.grosorLinea * e);

    const util = ancho - margen * 2;

    const elementos = [];
    let y = margen;

    /**
     * Agrega un texto y devuelve la altura con la que REALMENTE se dibujó.
     * Si no entra a lo ancho se achica solo, así nunca sale cortado.
     */
    const texto = (contenido, opciones) => {
      if (contenido === "" || contenido === null || contenido === undefined) return 0;

      const anchoCampo = opciones.ancho !== undefined ? opciones.ancho : util;
      const altura = zpl.alturaQueEntra(contenido, opciones.altura, anchoCampo);

      elementos.push({
        tipo: "texto",
        x: opciones.x !== undefined ? opciones.x : margen,
        y,
        altura,
        texto: String(contenido),
        negrita: !!opciones.negrita,
        alineacion: opciones.alineacion || "izq",
        ancho: anchoCampo,
      });

      return altura;
    };

    // En el nivel mínimo no hay líneas: cada una come milímetros que hacen
    // falta para que los datos entren.
    const linea = () => {
      if (detalle === MINIMA) return;
      elementos.push({ tipo: "linea", x: margen, y, ancho: util, grosor: T.grosorLinea });
      y += T.espacioMedio;
    };

    /** Los rótulos chicos ("MEDIDA", "BOBINA Nº") se omiten si falta lugar. */
    const rotulo = (txt) => {
      if (detalle === MINIMA) return;
      y += texto(txt, { altura: T.alturaRotulo }) + T.espacioChico;
    };

    // Cada texto devuelve la altura con la que terminó dibujándose, que puede
    // ser menor a la pedida si hubo que achicarlo. Por eso se avanza con lo
    // que devuelve y no con la constante: si no, quedarían huecos.

    // --- Marca de la fábrica (lo primero que se sacrifica) ---
    if (detalle === COMPLETA) {
      y += texto(datos.marcaPrincipal, { altura: T.alturaMarca, negrita: true }) + T.espacioChico;
      linea();
    }

    // --- La medida: el dato más importante de la etiqueta ---
    rotulo("MEDIDA");
    y += texto(medidaLegible(datos.anchoCm, datos.micrones), {
      altura: T.alturaMedida,
      negrita: true,
    });

    // El fuelle en su propio renglón, solo si lleva.
    if (datos.anchoFuelleCm) {
      y += T.espacioChico;
      y += texto(`FUELLE ${zpl.kilosLegibles(datos.anchoFuelleCm)} cm`, {
        altura: T.alturaMaterial,
        negrita: true,
      });
    }

    y += T.espacioChico;

    // Material y color: se mantienen salvo en el nivel mínimo.
    const materialYColor = [datos.material, datos.color].filter(Boolean).join(" · ");
    if (materialYColor && detalle !== MINIMA) {
      y += texto(materialYColor.toUpperCase(), { altura: T.alturaMaterial, negrita: true });
    }

    y += T.espacioChico;
    linea();

    // --- Número de bobina ---
    rotulo("BOBINA Nº");
    y += texto(datos.numeroBobina, { altura: T.alturaNumero, negrita: true }) + T.espacioChico;
    linea();

    /*
      Máquina, operario y turno comparten renglón. Cada uno tiene su tercio
      del ancho y no el ancho completo: si se midieran contra el total, los
      tres se creerían con lugar de sobra y terminarían montados.
    */
    const tercio = util / 3;
    texto(`MÁQ ${datos.maquina}`, {
      altura: T.alturaDatos,
      ancho: tercio,
      negrita: true,
    });
    texto(`OP ${datos.operario}`, {
      altura: T.alturaDatos,
      x: margen + tercio,
      ancho: tercio,
      negrita: true,
    });
    texto(String(datos.turno || "").toUpperCase(), {
      altura: T.alturaDatos,
      alineacion: "der",
      negrita: true,
    });
    y += T.alturaDatos + T.espacioChico;

    // La fecha es lo segundo que se sacrifica: el dato está en el sistema.
    if (detalle === COMPLETA) {
      y += texto(`${zpl.fechaLegible(datos.fecha)}   ${zpl.horaLegible(datos.hora)}`, {
        altura: T.alturaFecha,
      });
      y += T.espacioChico;
    }

    linea();

    /*
      El peso y los metros van en RENGLONES SEPARADOS.
      Antes compartían línea, uno a la izquierda y otro a la derecha, y con un
      peso de cinco cifras se montaban: salía "PESO: 50000 k4000 m".
    */
    y += texto(`PESO: ${zpl.kilosLegibles(datos.kilos)} kg`, {
      altura: T.alturaPeso,
      negrita: true,
    });

    if (datos.metros) {
      y += T.espacioChico;
      y += texto(`${zpl.kilosLegibles(datos.metros)} metros`, {
        altura: T.alturaMetros,
        negrita: true,
      });
    }

    y += T.espacioChico;

    // El pie con la marca del sistema solo si sobra lugar.
    if (datos.marcaSecundaria && detalle === COMPLETA) {
      y += texto(datos.marcaSecundaria, { altura: T.alturaPie });
    }

    const altoUsado = y + margen;

    // No alcanza con que entre a lo alto: si un texto es más ancho que su
    // espacio, la Zebra lo corta y nadie se entera hasta ver la etiqueta.
    const desbordan = elementos.filter(
      (el) => el.tipo === "texto" && zpl.anchoEstimado(el.texto, el.altura) > el.ancho + 0.5,
    );

    const textos = elementos.filter((el) => el.tipo === "texto");
    const letraMinima = textos.length ? Math.min(...textos.map((el) => el.altura)) : 0;

    return {
      ancho,
      alto,
      dpi: Number(formato.dpi) || 203,
      elementos,
      altoUsado,
      entra: altoUsado <= alto && desbordan.length === 0,
      entraAlto: altoUsado <= alto,
      desbordan: desbordan.map((el) => el.texto),
      letraMinima,
      // Por debajo de 2,5 mm la impresora térmica lo imprime, pero cuesta
      // leerlo de lejos en el depósito, que es donde se usa la etiqueta.
      letraChica: letraMinima > 0 && letraMinima < 2.5,
      nivel: detalle,
      escala: e,
      nivelTexto: ["completa", "compacta", "mínima"][detalle],
    };
  }

  /**
   * Elige el diseño más completo que entre en la etiqueta.
   *
   * Si ni el mínimo entra, devuelve ese igual con entra = false: la vista
   * previa lo muestra en rojo y dice cuántos milímetros se pasa, que es más
   * útil que no mostrar nada.
   */
  function mejorDisenio(datos, formato) {
    let ultimo = null;

    // Primero se prueba sacando elementos, que es preferible a achicar todo.
    for (const nivel of [COMPLETA, MEDIA, MINIMA]) {
      ultimo = calcularDisenioBobina(datos, formato, nivel, 1);
      if (ultimo.entra) return ultimo;
    }

    // Si ni el mínimo entra, se achica proporcionalmente. El piso de 0,4
    // es de legibilidad: más chico que eso, en una térmica no se lee.
    const alto = Number(formato.alto_mm);
    let escala = 1;
    for (let i = 0; i < 10; i++) {
      escala = Math.max(0.4, escala * (alto / ultimo.altoUsado) * 0.97);
      const intento = calcularDisenioBobina(datos, formato, MINIMA, escala);
      if (intento.entra) return intento;
      ultimo = intento;
      if (escala <= 0.4) break;
    }

    return ultimo;
  }

  /** Arma los datos de la etiqueta desde lo que devuelve Supabase. */
  function datosDeBobina(bobina, config, nombres) {
    return {
      marcaPrincipal: (config && config.marca_principal) || "",
      marcaSecundaria: (config && config.marca_secundaria) || "",
      numeroBobina: bobina.numero_bobina,
      anchoCm: bobina.ancho_cm,
      micrones: bobina.micrones,
      anchoFuelleCm: bobina.ancho_fuelle_cm,
      material: bobina.materiales ? bobina.materiales.nombre : "",
      color: bobina.colores ? bobina.colores.nombre : "",
      kilos: bobina.kilos,
      metros: bobina.metros,
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
    mejorDisenio,
    /** De los datos crudos al ZPL listo para mandar. */
    generar(datos, formato) {
      const disenio = mejorDisenio(datos, formato);
      // El motor de ZPL es el mismo que el de los pallets.
      return { zpl: window.App.zpl.aZpl(disenio), disenio };
    },
  };
})();

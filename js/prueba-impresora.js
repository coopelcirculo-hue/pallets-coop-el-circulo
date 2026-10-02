/**
 * Diagnóstico de la impresora.
 *
 * Sirve para saber en qué paso se corta la cadena, en vez de adivinar:
 *
 *   App (Chrome) → Zebra Browser Print (en la tablet) → Zebra ZD421 (en la red)
 *
 * La app nunca le habla directo a la impresora: el navegador no puede abrir
 * sockets. Por eso acá no se carga ninguna IP — la IP va adentro de Browser
 * Print, una sola vez.
 */

window.App = window.App || {};

(function () {
  const { useState } = React;

  /** Etiqueta de prueba con datos inventados, para ver tamaño y calidad. */
  function zplDePrueba(config, formato) {
    const datos = {
      marcaPrincipal: (config && config.marca_principal) || "PRUEBA",
      marcaSecundaria: "Etiqueta de prueba",
      numeroBobina: "B-000000",
      anchoCm: 45,
      micrones: 40,
      kilos: 100,
      maquina: "00",
      operario: "XX",
      turno: "Prueba",
      fecha: new Date().toISOString().slice(0, 10),
      hora: "12:00",
    };
    return window.App.zplBobina.generar(datos, formato);
  }

  /**
   * Cómo imprime ESTE dispositivo. Se guarda en la tablet, no en la base:
   * depende de si acá anda Browser Print, no de la fábrica.
   */
  function ModoImpresion() {
    const [modo, setModo] = useState(window.App.impresora.modoImpresion());

    function cambiar(nuevo) {
      window.App.impresora.setModoImpresion(nuevo);
      setModo(nuevo);
    }

    const opcion = (valor, titulo, texto) => {
      const elegida = modo === valor;
      return (
        <button
          onClick={() => cambiar(valor)}
          style={{
            flex: "1 1 240px",
            textAlign: "left",
            padding: 14,
            borderRadius: 12,
            cursor: "pointer",
            border: elegida ? "2px solid var(--acento)" : "1.5px solid var(--borde)",
            background: elegida ? "var(--panel)" : "var(--fondo)",
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: "var(--tinta)" }}>
            {elegida ? "● " : "○ "}
            {titulo}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--tinta-suave)" }}>{texto}</p>
        </button>
      );
    };

    return (
      <div className="panel">
        <h2>Cómo imprime esta tablet</h2>
        <p className="subtitulo">
          Es una opción <strong>de este dispositivo</strong>, no de la fábrica: otra tablet
          puede estar configurada distinto sin pisarse con esta.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {opcion(
            "browser_print",
            "Automático",
            "Manda la etiqueta sola a la Zebra con Browser Print. Es lo ideal cuando funciona.",
          )}
          {opcion(
            "descarga",
            "Descargar el archivo",
            "Baja un .zpl y lo abrís con Zebra Print Connect. Un toque más, pero anda siempre.",
          )}
        </div>

        {modo === "descarga" && (
          <window.App.Aviso tipo="ok">
            En este modo el sistema ni intenta Browser Print: no hay que esperar a que falle,
            y las bobinas no quedan marcadas con error. El botón de cargar bobina pasa a decir
            “Crear y descargar etiqueta”.
          </window.App.Aviso>
        )}
      </div>
    );
  }

  function PruebaImpresora() {
    const [estado, setEstado] = useState(null);
    const [probando, setProbando] = useState(false);
    const [disenio, setDisenio] = useState(null);

    async function probar() {
      if (probando) return;
      setProbando(true);
      setEstado(null);
      setDisenio(null);

      const pasos = [];
      try {
        // Paso 1: ¿hay formato y configuración cargados?
        const [{ data: config }, { data: formato }] = await Promise.all([
          window.App.db.from("configuracion").select("*").eq("id", 1).maybeSingle(),
          window.App.db
            .from("formatos_etiqueta")
            .select("*")
            .eq("predeterminado", true)
            .maybeSingle(),
        ]);

        if (!formato) {
          pasos.push({ ok: false, texto: "No hay ningún formato de etiqueta predeterminado." });
          setEstado({ pasos, resumen: "falta configurar la etiqueta" });
          return;
        }

        const conDpi = { ...formato, dpi: (config && config.impresora_dpi) || 203 };
        pasos.push({
          ok: true,
          texto: `Etiqueta ${formato.nombre}: ${formato.ancho_mm} × ${formato.alto_mm} mm a ${conDpi.dpi} dpi`,
        });

        const prueba = zplDePrueba(config, conDpi);
        setDisenio(prueba.disenio);

        if (!prueba.disenio.entra) {
          pasos.push({
            ok: false,
            texto: `El contenido ocupa ${prueba.disenio.altoUsado.toFixed(0)} mm y la etiqueta tiene ${formato.alto_mm} mm: se va a cortar.`,
          });
        }

        // Paso 2: ¿Browser Print está corriendo en este dispositivo?
        window.App.impresora.olvidarDeteccion();
        const encontrada = await window.App.impresora.buscarImpresora();

        if (!encontrada) {
          // Puede ser que Browser Print no esté, o que esté pero sin ninguna
          // impresora marcada como predeterminada. No es lo mismo.
          const todas = await window.App.impresora.listarImpresoras();

          if (todas && todas.length) {
            pasos.push({
              ok: false,
              texto:
                "Browser Print está y ve " +
                todas.length +
                " impresora(s) — " +
                todas.map((d) => d.name || d.uid).join(", ") +
                " — pero ninguna está marcada como PREDETERMINADA. Abrí Browser Print, tocá la impresora y ponela como Default.",
            });
          } else {
            pasos.push({
              ok: false,
              texto: "Browser Print no responde en este dispositivo.",
            });

            // Se muestra qué pasó con cada puerto: no es lo mismo que la app
            // no esté, a que esté y Chrome le corte por el certificado.
            window.App.impresora.ultimosIntentos().forEach((i) => {
              pasos.push({ ok: false, detalle: true, texto: `${i.base} → ${i.estado}` });
            });

            setEstado({
              pasos,
              resumen: "Browser Print no está disponible",
              mostrarCertificado: true,
            });
            return;
          }

          setEstado({ pasos, resumen: "Browser Print no está disponible" });
          return;
        }

        pasos.push({
          ok: true,
          texto:
            "Browser Print responde. Impresora predeterminada: " +
            (encontrada.dispositivo.name || "sin nombre"),
        });

        // Se listan todas para ver si la Zebra está cargada por Bluetooth o
        // por red, y si hay varias cuál quedó de predeterminada.
        const todas = await window.App.impresora.listarImpresoras();
        if (todas && todas.length) {
          const detalle = todas
            .map((d) => {
              const via = d.connection ? ` (${d.connection})` : "";
              return (d.name || d.uid || "sin nombre") + via;
            })
            .join(" · ");
          pasos.push({
            ok: true,
            texto: `Browser Print tiene ${todas.length} ${todas.length === 1 ? "impresora" : "impresoras"}: ${detalle}`,
          });
        }

        // Paso 3: mandar la etiqueta de prueba
        try {
          const nombre = await window.App.impresora.enviarPorBrowserPrint(prueba.zpl);
          pasos.push({ ok: true, texto: "Etiqueta de prueba enviada a " + nombre });
          setEstado({ pasos, resumen: "todo conectado", zpl: prueba.zpl });
        } catch (e) {
          pasos.push({
            ok: false,
            texto:
              "Browser Print está, pero no pudo mandar el trabajo: " +
              e.message +
              ". Suele ser que la impresora está apagada o que la IP cargada en Browser Print cambió.",
          });
          setEstado({ pasos, resumen: "no llegó a la impresora", zpl: prueba.zpl });
        }
      } catch (e) {
        pasos.push({ ok: false, texto: e.message });
        setEstado({ pasos, resumen: "error" });
      } finally {
        setProbando(false);
      }
    }

    return (
      <div className="panel">
        <h2>Probar la impresora</h2>
        <p className="subtitulo">
          Manda una etiqueta de prueba y te dice en qué paso se corta si algo no anda. La IP de
          la impresora no se carga acá: va adentro de la app Zebra Browser Print, en la tablet.
        </p>

        <button className="boton" onClick={probar} disabled={probando}>
          {probando ? "Probando…" : "Probar e imprimir una etiqueta"}
        </button>

        {estado && (
          <div style={{ marginTop: 16 }}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {estado.pasos.map((p, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: p.detalle ? "2px 0 2px 26px" : "8px 0",
                    borderBottom: p.detalle ? "none" : "1px solid var(--borde)",
                    fontSize: p.detalle ? 13 : undefined,
                    color: p.detalle ? "var(--tinta-suave)" : undefined,
                  }}
                >
                  {!p.detalle && <span aria-hidden>{p.ok ? "✅" : "❌"}</span>}
                  <span
                    style={{
                      color: p.detalle
                        ? "var(--tinta-suave)"
                        : p.ok
                          ? "var(--tinta)"
                          : "var(--error)",
                    }}
                  >
                    {p.texto}
                  </span>
                </li>
              ))}
            </ul>

            {/*
              El motivo más común de que no responda: nuestra página es HTTPS
              y Browser Print escucha con un certificado propio que Chrome no
              conoce. Hay que aceptarlo UNA vez, abriéndolo directo.
            */}
            {estado.mostrarCertificado && (
              <div className="aviso atencion" style={{ marginTop: 12 }}>
                <p style={{ margin: "0 0 8px" }}>
                  <strong>Lo más probable: falta aceptar el certificado.</strong> Esta página
                  es segura (https) y Browser Print usa un certificado propio que Chrome no
                  conoce, así que corta la comunicación sin avisar.
                </p>
                <p style={{ margin: "0 0 10px" }}>
                  Abrí este link en la misma tablet, tocá <strong>Configuración avanzada</strong>{" "}
                  → <strong>Acceder a 127.0.0.1 (no seguro)</strong>, y si pregunta si querés
                  agregarlo como host aceptado, decile que sí. Después volvé acá y probá de
                  nuevo.
                </p>
                <a
                  className="boton"
                  href="https://127.0.0.1:9101"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-block", textDecoration: "none", lineHeight: "50px" }}
                >
                  Abrir https://127.0.0.1:9101
                </a>
                <p style={{ margin: "10px 0 0", fontSize: 14 }}>
                  Si esa página tampoco abre, entonces Browser Print no está corriendo:
                  abrilo desde el menú de aplicaciones y dejalo abierto una vez.
                </p>
              </div>
            )}

            {estado.zpl && (
              <button
                className="boton secundario"
                style={{ marginTop: 12 }}
                onClick={() => window.App.impresora.descargarZpl(estado.zpl, "prueba")}
              >
                Descargar la etiqueta de prueba (.zpl)
              </button>
            )}
          </div>
        )}

        {disenio && (
          <div style={{ marginTop: 16 }}>
            <window.App.VistaPrevia disenio={disenio} escala={2.2} />
          </div>
        )}
      </div>
    );
  }

  window.App.ModoImpresion = ModoImpresion;
  window.App.PruebaImpresora = PruebaImpresora;
})();

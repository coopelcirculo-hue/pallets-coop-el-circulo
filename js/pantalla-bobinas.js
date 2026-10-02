/**
 * Historial y reimpresión de bobinas.
 *
 * Mismo criterio que la de pallets: una sola vista de detalle, y la pantalla
 * de Reimpresión es la misma sin la edición de observaciones, porque ahí el
 * responsable viene a una sola cosa.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  /* --- Buscador --------------------------------------------------------- */

  function BuscadorBobinas({ onElegir, ayuda }) {
    const [texto, setTexto] = useState("");
    const [filas, setFilas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
      // Espera antes de consultar y descarta respuestas viejas, igual que el
      // buscador de pallets: ver js/buscador-pallets.js.
      let vigente = true;
      setCargando(true);

      const reloj = setTimeout(async () => {
        try {
          const r = await window.App.bobinas.buscar(texto);
          if (vigente) {
            setFilas(r);
            setError("");
          }
        } catch (e) {
          if (vigente) setError(e.message);
        } finally {
          if (vigente) setCargando(false);
        }
      }, 250);

      return () => {
        vigente = false;
        clearTimeout(reloj);
      };
    }, [texto]);

    return (
      <div>
        <div className="campo">
          <label>Buscar por número de bobina</label>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="1234"
            inputMode="search"
            autoCapitalize="none"
          />
          {ayuda && (
            <p className="subtitulo" style={{ margin: "6px 0 0" }}>
              {ayuda}
            </p>
          )}
        </div>

        <window.App.Aviso tipo="error">{error}</window.App.Aviso>

        {cargando ? (
          <div className="cargando">Buscando…</div>
        ) : filas.length === 0 ? (
          <div className="vacio">
            {texto.trim()
              ? `No hay ninguna bobina que contenga "${texto.trim()}".`
              : "Todavía no se cargó ninguna bobina."}
          </div>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Bobina</th>
                  <th>Medida</th>
                  <th>Máq.</th>
                  <th>Op.</th>
                  <th style={{ textAlign: "right" }}>Kilos</th>
                  <th>Impresión</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.numero_bobina}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{window.App.bobinas.medida(b)}</td>
                    <td>{window.App.bobinas.numeroMaquina(b.maquinas)}</td>
                    <td>{b.operarios ? b.operarios.iniciales : "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {window.App.zpl.kilosLegibles(b.kilos)} kg
                      {b.metros && (
                        <>
                          <br />
                          <span style={{ color: "var(--tinta-tenue)", fontSize: 13 }}>
                            {window.App.zpl.kilosLegibles(b.metros)} m
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      <window.App.EstadoPallet estado={b.estado_impresion} />
                    </td>
                    <td>
                      <div className="acciones">
                        <button className="boton chico secundario" onClick={() => onElegir(b)}>
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* --- Detalle ---------------------------------------------------------- */

  function DetalleBobina({ bobinaId, onVolver, permitirEditar }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [avisoObs, setAvisoObs] = useState("");
    const [impresion, setImpresion] = useState(null);

    async function cargar() {
      try {
        const d = await window.App.bobinas.detalle(bobinaId);
        setDatos(d);
        setObservaciones(d.bobina.observaciones || "");
      } catch (e) {
        setError(e.message);
      }
    }

    useEffect(() => {
      cargar();
    }, [bobinaId]);

    async function guardarObs() {
      if (guardando) return;
      setGuardando(true);
      try {
        const limpio = observaciones.trim();
        const { error } = await window.App.db
          .from("bobinas")
          .update({ observaciones: limpio === "" ? null : limpio })
          .eq("id", bobinaId);
        if (error) throw new Error(window.App.ui.mensajeDeError(error));
        setAvisoObs("Guardado.");
        setTimeout(() => setAvisoObs(""), 2500);
      } catch (e) {
        setError(e.message);
      } finally {
        setGuardando(false);
      }
    }

    async function reimprimir(reintentando) {
      setImpresion({ estado: "enviando" });
      try {
        const r = await window.App.impresora.imprimirBobina(bobinaId, {
          esReimpresion: true,
          reintentarDeteccion: !!reintentando,
        });
        setImpresion({
          estado: r.ok ? "ok" : "error",
          mensaje: r.mensaje,
          zpl: r.zpl,
          disenio: r.disenio,
          descargado: r.descargado,
        });
        cargar();
      } catch (e) {
        setImpresion({ estado: "error", mensaje: e.message });
      }
    }

    if (error) {
      return (
        <div className="panel">
          <window.App.Aviso tipo="error">{error}</window.App.Aviso>
          <button className="boton secundario" onClick={onVolver}>
            Volver
          </button>
        </div>
      );
    }

    if (!datos) return <div className="cargando">Cargando…</div>;

    const { bobina, impresiones } = datos;
    const zplLib = window.App.zpl;
    const estadoImp = impresion ? impresion.estado : null;

    const dato = (rotulo, valor) => (
      <div style={{ minWidth: 140, flex: "1 1 140px" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>{rotulo}</p>
        <p style={{ margin: 0, fontWeight: 600 }}>{valor || "—"}</p>
      </div>
    );

    return (
      <div>
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>Bobina</p>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{bobina.numero_bobina}</p>
              <p style={{ margin: 0, fontSize: 20 }}>
                {window.App.bobinas.medida(bobina)}
              </p>
              {window.App.bobinas.materialYColor(bobina) && (
                <p style={{ margin: 0, fontSize: 17, color: "var(--tinta-suave)" }}>
                  {window.App.bobinas.materialYColor(bobina)}
                </p>
              )}
              <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700 }}>
                {zplLib.kilosLegibles(bobina.kilos)} kg
                {bobina.metros ? ` · ${zplLib.kilosLegibles(bobina.metros)} m` : ""}
              </p>
              {bobina.aditivos_texto && (
                <p style={{ margin: "2px 0 0", fontSize: 15, color: "var(--acento)" }}>
                  Lleva: {bobina.aditivos_texto}
                </p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <window.App.EstadoPallet estado={bobina.estado_impresion} />
              <button className="boton chico secundario" onClick={onVolver}>
                Volver
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 18 }}>
            {dato("Máquina", window.App.bobinas.numeroMaquina(bobina.maquinas))}
            {dato(
              "Operario",
              bobina.operarios && `${bobina.operarios.nombre} (${bobina.operarios.iniciales})`,
            )}
            {dato("Turno", bobina.turno)}
            {dato("Fecha", zplLib.fechaLegible(bobina.fecha))}
            {dato("Hora", zplLib.horaLegible(bobina.hora))}
            {dato("Jornada", zplLib.fechaLegible(bobina.fecha_produccion))}
            {dato("Cargada por", bobina.usuarios && bobina.usuarios.nombre)}
            {dato("Pallet", bobina.pallet_id ? "asignada" : "suelta")}
          </div>
        </div>

        {permitirEditar && (
          <div className="panel">
            <h2>Observaciones</h2>
            <window.App.Aviso tipo="ok">{avisoObs}</window.App.Aviso>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Sin observaciones"
            />
            <button className="boton" onClick={guardarObs} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar observaciones"}
            </button>
          </div>
        )}

        <div className="panel">
          <h2>Reimprimir</h2>
          <p className="subtitulo">
            Reenvía la misma etiqueta que se generó la primera vez, aunque esa máquina hoy esté
            produciendo otra medida.
          </p>

          {estadoImp === "ok" && (
            <window.App.Aviso tipo="ok">
              {impresion.descargado
                ? `Se bajó ${bobina.numero_bobina}.zpl. Abrilo con Zebra Print Connect.`
                : "Etiqueta enviada."}
            </window.App.Aviso>
          )}
          {estadoImp === "error" && (
            <window.App.Aviso tipo="atencion">
              No se pudo imprimir: {String(impresion.mensaje || "").replace(/\.\s*$/, "")}. Podés
              bajar el archivo y abrirlo con Print Connect.
            </window.App.Aviso>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="boton"
              onClick={() => reimprimir(false)}
              disabled={estadoImp === "enviando"}
            >
              {estadoImp === "enviando"
                ? "Enviando…"
                : window.App.impresora.modoImpresion() === "descarga"
                  ? "Descargar la etiqueta otra vez"
                  : "Reimprimir etiqueta"}
            </button>
            {impresion && impresion.zpl && (
              <button
                className="boton secundario"
                onClick={() =>
                  window.App.impresora.descargarZpl(impresion.zpl, bobina.numero_bobina)
                }
              >
                Descargar .zpl
              </button>
            )}
            {estadoImp === "error" && (
              <button className="boton secundario" onClick={() => reimprimir(true)}>
                Reintentar
              </button>
            )}
          </div>

          {impresion && impresion.disenio && (
            <div style={{ marginTop: 16 }}>
              <window.App.VistaPrevia disenio={impresion.disenio} escala={2.2} />
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Impresiones de esta bobina</h2>
          {impresiones.length === 0 ? (
            <div className="vacio">Todavía no se imprimió nunca.</div>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Cuándo</th>
                    <th>Resultado</th>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {impresiones.map((i) => (
                    <tr key={i.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(i.creado_en).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <span
                          className="etiqueta-estado"
                          style={
                            i.resultado === "ok"
                              ? { background: "var(--ok-fondo)", color: "var(--ok)" }
                              : { background: "var(--error-fondo)", color: "var(--error)" }
                          }
                        >
                          {i.resultado === "ok" ? "OK" : "Error"}
                        </span>
                      </td>
                      <td>{i.es_reimpresion ? "Reimpresión" : "Original"}</td>
                      <td>{i.dispositivo || "—"}</td>
                      <td style={{ fontSize: 13, color: "var(--tinta-suave)" }}>
                        {i.detalle || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* --- Las dos pantallas ------------------------------------------------ */

  function HistorialBobinas() {
    const [elegida, setElegida] = useState(null);

    if (elegida) {
      return (
        <DetalleBobina
          bobinaId={elegida.id}
          onVolver={() => setElegida(null)}
          permitirEditar={true}
        />
      );
    }

    return (
      <div className="panel">
        <h1>📋 Historial</h1>
        <p className="subtitulo">
          Todas las bobinas, de la más nueva a la más vieja. Escribí parte del número para
          filtrar.
        </p>
        <BuscadorBobinas
          onElegir={setElegida}
          ayuda="Con escribir 1234 alcanza: no hace falta poner B-001234."
        />
      </div>
    );
  }

  function ReimpresionBobinas() {
    const [elegida, setElegida] = useState(null);

    if (elegida) {
      return (
        <DetalleBobina
          bobinaId={elegida.id}
          onVolver={() => setElegida(null)}
          permitirEditar={false}
        />
      );
    }

    return (
      <div className="panel">
        <h1>🖨️ Reimpresión</h1>
        <p className="subtitulo">
          Si la etiqueta se rompió o se despegó, buscá la bobina acá y reimprimila.
        </p>
        <BuscadorBobinas onElegir={setElegida} ayuda="Sale idéntica a la original." />
      </div>
    );
  }

  window.App.BuscadorBobinas = BuscadorBobinas;
  window.App.DetalleBobina = DetalleBobina;
  window.App.PantallaHistorialBobinas = HistorialBobinas;
  window.App.PantallaReimpresionBobinas = ReimpresionBobinas;
})();

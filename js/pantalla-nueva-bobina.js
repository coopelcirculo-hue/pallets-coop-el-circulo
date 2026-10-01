/**
 * Nueva bobina: la pantalla de uso diario.
 *
 * Pensada para 10 segundos por bobina. Como cada máquina ya recuerda qué está
 * produciendo —medida, fuelle, material, color y aditivos—, el responsable
 * elige la máquina, pone kilos y metros, y listo.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  // Se recuerda en la tablet qué operario está en cada máquina, para no tener
  // que elegirlo en cada bobina. No va a la base: es una comodidad local que
  // cambia por turno y por dispositivo.
  const CLAVE_OPERARIOS = "pallets_operario_por_maquina";

  function leerOperarios() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_OPERARIOS) || "{}");
    } catch {
      return {};
    }
  }

  function guardarOperario(maquinaId, operarioId) {
    try {
      const todos = leerOperarios();
      todos[maquinaId] = operarioId;
      localStorage.setItem(CLAVE_OPERARIOS, JSON.stringify(todos));
    } catch {
      // Si el navegador no deja guardar, no pasa nada: se elige a mano.
    }
  }

  function NuevaBobina() {
    const [maquinas, setMaquinas] = useState(null);
    const [operarios, setOperarios] = useState([]);
    const [errorCarga, setErrorCarga] = useState("");

    const [maquinaId, setMaquinaId] = useState("");
    const [operarioId, setOperarioId] = useState("");
    const [kilos, setKilos] = useState("");
    const [metros, setMetros] = useState("");
    const [observaciones, setObservaciones] = useState("");

    const [editandoProducto, setEditandoProducto] = useState(false);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [creada, setCreada] = useState(null);
    const [impresion, setImpresion] = useState(null);

    async function cargarMaquinas() {
      try {
        const m = await window.App.bobinas.maquinasConCorrida();
        setMaquinas(m);
        return m;
      } catch (e) {
        setErrorCarga(e.message);
        return [];
      }
    }

    useEffect(() => {
      (async () => {
        const ops = await window.App.db
          .from("operarios")
          .select("id, nombre, iniciales")
          .eq("activo", true)
          .order("nombre");
        if (ops.error) setErrorCarga(window.App.ui.mensajeDeError(ops.error));
        else setOperarios(ops.data || []);
        await cargarMaquinas();
      })();
    }, []);

    const maquina = (maquinas || []).find((m) => m.id === maquinaId) || null;
    const corrida = maquina ? maquina.corrida : null;

    function elegirMaquina(m) {
      setMaquinaId(m.id);
      setError("");

      // Se recupera el operario que venía cargando en esa máquina.
      const recordados = leerOperarios();
      setOperarioId(recordados[m.id] || "");

      if (m.numero === null || m.numero === undefined) {
        setError(
          `La máquina "${m.nombre}" no tiene número cargado. Ponéselo en Configuración: el número forma parte del número de bobina.`,
        );
      }

      // Sin producto definido no se puede cargar nada: se abre el editor.
      setEditandoProducto(!m.corrida);
    }

    function validar() {
      if (!maquinaId) return "Elegí la máquina.";
      if (maquina && (maquina.numero === null || maquina.numero === undefined)) {
        return `La máquina "${maquina.nombre}" no tiene número. Cargáselo en Configuración.`;
      }
      if (!corrida) return "Esa máquina no tiene cargado qué está produciendo.";
      if (editandoProducto) return "Guardá primero lo que está haciendo la máquina.";
      if (!operarioId) return "Elegí el operario.";

      const k = parseFloat(kilos);
      if (isNaN(k) || k <= 0) return "Poné los kilos de la bobina.";

      if (metros !== "") {
        const m = parseFloat(metros);
        if (isNaN(m) || m <= 0) return "Los metros tienen que ser mayores a cero, o quedar vacíos.";
      }
      return null;
    }

    async function crear() {
      if (guardando) return; // anti doble toque

      const problema = validar();
      if (problema) return setError(problema);

      setGuardando(true);
      setError("");

      try {
        const bobina = await window.App.bobinas.crear({
          maquinaId,
          operarioId,
          kilos: parseFloat(kilos),
          metros: metros === "" ? null : parseFloat(metros),
          observaciones,
        });
        guardarOperario(maquinaId, operarioId);
        setCreada(bobina);
        imprimir(bobina);
      } catch (e) {
        setError(e.message);
      } finally {
        setGuardando(false);
      }
    }

    async function imprimir(bobina, reintentando) {
      setImpresion({ estado: "enviando" });
      try {
        const r = await window.App.impresora.imprimirBobina(bobina.id, {
          reintentarDeteccion: !!reintentando,
        });
        setImpresion({
          estado: r.ok ? "ok" : "error",
          mensaje: r.mensaje,
          zpl: r.zpl,
          disenio: r.disenio,
        });
      } catch (e) {
        setImpresion({ estado: "error", mensaje: e.message });
      }
    }

    /** Otra bobina de la misma máquina: solo se limpian kilos y metros. */
    function otraBobina() {
      setCreada(null);
      setImpresion(null);
      setKilos("");
      setMetros("");
      setObservaciones("");
      setError("");
    }

    /* --- Render ---------------------------------------------------------- */

    if (errorCarga) {
      return (
        <div className="panel">
          <window.App.Aviso tipo="error">{errorCarga}</window.App.Aviso>
        </div>
      );
    }

    if (!maquinas) return <div className="cargando">Cargando…</div>;

    if (maquinas.length === 0 || operarios.length === 0) {
      return (
        <div className="panel">
          <h1>🧵 Nueva bobina</h1>
          <window.App.Aviso tipo="atencion">
            Faltan datos. Andá a Configuración y cargá al menos una máquina (con su número) y
            un operario.
          </window.App.Aviso>
        </div>
      );
    }

    // --- Confirmación ---
    if (creada) {
      const estado = impresion ? impresion.estado : "enviando";
      return (
        <div>
          <div className="panel" style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 15, color: "var(--tinta-suave)" }}>Bobina creada</p>
            <p style={{ margin: "6px 0", fontSize: 40, fontWeight: 800 }}>
              {creada.numero_bobina}
            </p>
            <p style={{ margin: 0, fontSize: 19 }}>
              {window.App.bobinas.medida(creada)}
            </p>
            <p style={{ margin: "2px 0", fontSize: 19, fontWeight: 700 }}>
              {window.App.zpl.kilosLegibles(creada.kilos)} kg
              {creada.metros ? ` · ${window.App.zpl.kilosLegibles(creada.metros)} m` : ""}
            </p>
            <p style={{ margin: "2px 0 10px", color: "var(--tinta-suave)" }}>
              Máquina {window.App.bobinas.numeroMaquina(maquina)} · turno {creada.turno}
            </p>

            {estado === "enviando" && <span className="etiqueta-estado no">Imprimiendo…</span>}
            {estado === "ok" && <span className="etiqueta-estado si">Impreso ✓</span>}
            {estado === "error" && (
              <span
                className="etiqueta-estado"
                style={{ background: "var(--error-fondo)", color: "var(--error)" }}
              >
                No se pudo imprimir
              </span>
            )}

            {estado === "error" && (
              <window.App.Aviso tipo="atencion">
                La bobina quedó registrada igual, solo faltó la etiqueta:{" "}
                {String(impresion.mensaje || "").replace(/\.\s*$/, "")}.
              </window.App.Aviso>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button className="boton" style={{ flex: 1 }} onClick={otraBobina}>
                Otra bobina de la {window.App.bobinas.numeroMaquina(maquina)}
              </button>
              {impresion && impresion.zpl && (
                <button
                  className="boton secundario"
                  onClick={() =>
                    window.App.impresora.descargarZpl(impresion.zpl, creada.numero_bobina)
                  }
                >
                  Descargar .zpl
                </button>
              )}
              {estado === "error" && (
                <button className="boton secundario" onClick={() => imprimir(creada, true)}>
                  Reintentar
                </button>
              )}
            </div>
          </div>

          {impresion && impresion.disenio && (
            <div className="panel">
              <h2>Vista previa</h2>
              <window.App.VistaPrevia disenio={impresion.disenio} escala={2.4} />
            </div>
          )}
        </div>
      );
    }

    // --- Carga ---
    const detalle = corrida ? window.App.bobinas.materialYColor(corrida) : "";
    const aditivos = corrida ? window.App.bobinas.aditivosDeCorrida(corrida) : "";

    return (
      <div>
        <div className="panel">
          <h1>🧵 Nueva bobina</h1>
          <window.App.Aviso tipo="error">{error}</window.App.Aviso>

          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--tinta-suave)",
            }}
          >
            Máquina
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {maquinas.map((m) => {
              const elegida = m.id === maquinaId;
              return (
                <button
                  key={m.id}
                  onClick={() => elegirMaquina(m)}
                  title={m.nombre}
                  style={{
                    minWidth: 78,
                    minHeight: 64,
                    borderRadius: 12,
                    border: elegida ? "none" : "1.5px solid var(--borde)",
                    background: elegida ? "var(--primario)" : "var(--panel)",
                    color: elegida ? "#fff" : "var(--tinta)",
                    fontSize: 24,
                    fontWeight: 800,
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  {window.App.bobinas.numeroMaquina(m)}
                  {!m.corrida && (
                    <span
                      title="Sin producto cargado"
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 8,
                        fontSize: 13,
                        color: "var(--aviso)",
                      }}
                    >
                      ●
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {maquina && (
          <>
            <div className="panel">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>
                    La máquina {window.App.bobinas.numeroMaquina(maquina)} está haciendo
                  </p>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
                    {corrida ? window.App.bobinas.medida(corrida) : "sin definir"}
                  </p>
                  {detalle && (
                    <p style={{ margin: 0, fontSize: 18, color: "var(--tinta-suave)" }}>
                      {detalle}
                    </p>
                  )}
                  {aditivos && (
                    <p style={{ margin: "4px 0 0", fontSize: 16, color: "var(--acento)", fontWeight: 600 }}>
                      Lleva: {aditivos}
                    </p>
                  )}
                  {corrida && corrida.observaciones && (
                    <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--tinta-tenue)" }}>
                      {corrida.observaciones}
                    </p>
                  )}
                </div>
                {!editandoProducto && (
                  <button
                    className="boton chico secundario"
                    onClick={() => setEditandoProducto(true)}
                  >
                    Cambiar producto
                  </button>
                )}
              </div>

              {editandoProducto && (
                <>
                  <p className="subtitulo" style={{ marginTop: 14, marginBottom: 0 }}>
                    Esto cambia lo que está produciendo la máquina, no solo esta bobina.
                  </p>
                  <window.App.EditorCorrida
                    maquina={maquina}
                    alGuardar={async () => {
                      setEditandoProducto(false);
                      await cargarMaquinas();
                    }}
                    alCancelar={corrida ? () => setEditandoProducto(false) : null}
                  />
                </>
              )}
            </div>

            {!editandoProducto && (
              <div className="panel">
                <div className="fila">
                  <div className="campo">
                    <label>Operario</label>
                    <select value={operarioId} onChange={(e) => setOperarioId(e.target.value)}>
                      <option value="">Elegir…</option>
                      {operarios.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre} ({o.iniciales})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="campo">
                    <label>Kilos *</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={kilos}
                      onChange={(e) => setKilos(e.target.value)}
                      placeholder="0"
                      style={{ fontSize: 26, fontWeight: 700, minHeight: 62 }}
                    />
                  </div>

                  <div className="campo">
                    <label>Metros</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={metros}
                      onChange={(e) => setMetros(e.target.value)}
                      placeholder="Opcional"
                      style={{ fontSize: 26, fontWeight: 700, minHeight: 62 }}
                    />
                  </div>
                </div>

                <div className="campo">
                  <label>Observaciones de esta bobina</label>
                  <input
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <button className="boton ancho" onClick={crear} disabled={guardando}>
                  {guardando ? "Creando…" : "Crear e imprimir"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  window.App.PantallaNuevaBobina = NuevaBobina;
})();

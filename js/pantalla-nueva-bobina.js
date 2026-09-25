/**
 * Nueva bobina: la pantalla de uso diario.
 *
 * Pensada para 10 segundos por bobina, no un minuto. Como cada máquina ya
 * recuerda qué está produciendo, el responsable elige la máquina, pone los
 * kilos y listo: la medida sale sola de la corrida activa de esa máquina.
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
    const [observaciones, setObservaciones] = useState("");

    const [cambiandoMedida, setCambiandoMedida] = useState(false);
    const [ancho, setAncho] = useState("");
    const [micrones, setMicrones] = useState("");

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
        const [m, ops] = await Promise.all([
          cargarMaquinas(),
          window.App.db.from("operarios").select("id, nombre, iniciales").eq("activo", true).order("nombre"),
        ]);
        if (ops.error) setErrorCarga(window.App.ui.mensajeDeError(ops.error));
        else setOperarios(ops.data || []);
        void m;
      })();
    }, []);

    const maquina = (maquinas || []).find((m) => m.id === maquinaId) || null;
    const corrida = maquina ? maquina.corrida : null;

    function elegirMaquina(m) {
      setMaquinaId(m.id);
      setError("");
      setCambiandoMedida(false);

      // Se recupera el operario que venía cargando en esa máquina.
      const recordados = leerOperarios();
      setOperarioId(recordados[m.id] || "");

      if (m.corrida) {
        setAncho(String(m.corrida.ancho_cm));
        setMicrones(String(m.corrida.micrones));
      } else {
        // Máquina sin corrida: hay que decir qué está haciendo antes de cargar.
        setAncho("");
        setMicrones("");
        setCambiandoMedida(true);
      }
    }

    async function guardarMedida() {
      const a = parseFloat(ancho);
      const mic = parseFloat(micrones);
      if (isNaN(a) || a <= 0) return setError("El ancho tiene que ser mayor a cero.");
      if (isNaN(mic) || mic <= 0) return setError("Los micrones tienen que ser mayores a cero.");

      try {
        await window.App.bobinas.definirCorrida(maquinaId, a, mic, null);
        await cargarMaquinas();
        setCambiandoMedida(false);
        setError("");
      } catch (e) {
        setError(e.message);
      }
    }

    function validar() {
      if (!maquinaId) return "Elegí la máquina.";
      if (!operarioId) return "Elegí el operario.";
      if (!corrida && !cambiandoMedida) return "Esa máquina no tiene cargado qué está produciendo.";
      if (cambiandoMedida) return "Guardá primero la medida de la máquina.";
      const k = parseFloat(kilos);
      if (isNaN(k) || k <= 0) return "Poné los kilos de la bobina.";
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

    /** Otra bobina de la misma máquina: solo se limpian los kilos. */
    function otraBobina() {
      setCreada(null);
      setImpresion(null);
      setKilos("");
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
              {window.App.bobinas.medida(creada)} · {window.App.zpl.kilosLegibles(creada.kilos)} kg
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
    return (
      <div>
        <div className="panel">
          <h1>🧵 Nueva bobina</h1>
          <window.App.Aviso tipo="error">{error}</window.App.Aviso>

          <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600, color: "var(--tinta-suave)" }}>
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
                      title="Sin medida cargada"
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
                  alignItems: "center",
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
                </div>
                {!cambiandoMedida && (
                  <button className="boton chico secundario" onClick={() => setCambiandoMedida(true)}>
                    Cambiar medida
                  </button>
                )}
              </div>

              {cambiandoMedida && (
                <div style={{ marginTop: 14 }}>
                  <p className="subtitulo">
                    Esto cambia lo que está produciendo la máquina, no solo esta bobina.
                  </p>
                  <div className="fila">
                    <div className="campo">
                      <label>Ancho (cm)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={ancho}
                        onChange={(e) => setAncho(e.target.value)}
                        placeholder="45"
                      />
                    </div>
                    <div className="campo">
                      <label>Micrones</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={micrones}
                        onChange={(e) => setMicrones(e.target.value)}
                        placeholder="40"
                      />
                    </div>
                    <div className="campo" style={{ flex: "0 0 auto" }}>
                      <label>&nbsp;</label>
                      <button className="boton" onClick={guardarMedida}>
                        Guardar medida
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                  <label>Kilos</label>
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
              </div>

              <div className="campo">
                <label>Observaciones</label>
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
          </>
        )}
      </div>
    );
  }

  window.App.PantallaNuevaBobina = NuevaBobina;
})();

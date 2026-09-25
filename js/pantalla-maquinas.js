/**
 * Tablero de máquinas: qué está haciendo cada una y cuánto lleva en la jornada.
 *
 * Es la foto de la planta de un vistazo. Con más de diez extrusoras, saber qué
 * medida está corriendo cada una es la mitad del trabajo del responsable.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  function FilaMaquina({ maquina, produccion, alGuardar }) {
    const [editando, setEditando] = useState(false);
    const [ancho, setAncho] = useState("");
    const [micrones, setMicrones] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");

    function abrir() {
      setAncho(maquina.corrida ? String(maquina.corrida.ancho_cm) : "");
      setMicrones(maquina.corrida ? String(maquina.corrida.micrones) : "");
      setError("");
      setEditando(true);
    }

    async function guardar() {
      const a = parseFloat(ancho);
      const m = parseFloat(micrones);
      if (isNaN(a) || a <= 0) return setError("Ancho inválido.");
      if (isNaN(m) || m <= 0) return setError("Micrones inválidos.");

      setGuardando(true);
      try {
        await window.App.bobinas.definirCorrida(maquina.id, a, m, null);
        setEditando(false);
        await alGuardar();
      } catch (e) {
        setError(e.message);
      } finally {
        setGuardando(false);
      }
    }

    const p = produccion || { bobinas: 0, kilos: 0 };

    return (
      <div className="panel" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              minWidth: 62,
              height: 62,
              borderRadius: 12,
              background: "var(--primario)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            {window.App.bobinas.numeroMaquina(maquina)}
          </div>

          <div style={{ flex: "1 1 180px" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>
              {maquina.nombre}
            </p>
            {maquina.corrida ? (
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                {window.App.bobinas.medida(maquina.corrida)}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 18, color: "var(--aviso)", fontWeight: 600 }}>
                Sin medida cargada
              </p>
            )}
          </div>

          <div style={{ textAlign: "right", minWidth: 120 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>En la jornada</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {window.App.zpl.kilosLegibles(p.kilos)} kg
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-suave)" }}>
              {p.bobinas} {p.bobinas === 1 ? "bobina" : "bobinas"}
            </p>
          </div>

          {!editando && (
            <button className="boton chico secundario" onClick={abrir}>
              {maquina.corrida ? "Cambiar" : "Cargar medida"}
            </button>
          )}
        </div>

        {editando && (
          <div style={{ marginTop: 14 }}>
            <window.App.Aviso tipo="error">{error}</window.App.Aviso>
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
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="boton" onClick={guardar} disabled={guardando}>
                    {guardando ? "…" : "Guardar"}
                  </button>
                  <button className="boton secundario" onClick={() => setEditando(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function Maquinas() {
    const [maquinas, setMaquinas] = useState(null);
    const [produccion, setProduccion] = useState({});
    const [error, setError] = useState("");

    async function cargar() {
      try {
        const jornada = window.App.hoyArgentina();
        const [m, bobinas] = await Promise.all([
          window.App.bobinas.maquinasConCorrida(),
          window.App.bobinas.deLaJornada(jornada),
        ]);

        // Se suma por máquina lo producido en la jornada.
        const porMaquina = {};
        bobinas.forEach((b) => {
          const numero = b.maquinas ? b.maquinas.numero : null;
          const clave = numero === null ? b.maquinas && b.maquinas.nombre : numero;
          if (clave === null || clave === undefined) return;
          const actual = porMaquina[clave] || { bobinas: 0, kilos: 0 };
          actual.bobinas += 1;
          actual.kilos += Number(b.kilos) || 0;
          porMaquina[clave] = actual;
        });

        setMaquinas(m);
        setProduccion(porMaquina);
      } catch (e) {
        setError(e.message);
      }
    }

    useEffect(() => {
      cargar();
    }, []);

    if (error) {
      return (
        <div className="panel">
          <window.App.Aviso tipo="error">{error}</window.App.Aviso>
        </div>
      );
    }

    if (!maquinas) return <div className="cargando">Cargando…</div>;

    const sinMedida = maquinas.filter((m) => !m.corrida);

    return (
      <div>
        <div className="panel">
          <h1>⚙️ Máquinas</h1>
          <p className="subtitulo">
            Qué está produciendo cada extrusora ahora mismo. Al cargar una bobina, la medida
            sale de acá.
          </p>
          {sinMedida.length > 0 && (
            <window.App.Aviso tipo="atencion">
              {sinMedida.length === 1
                ? "Hay 1 máquina sin medida cargada: no se le pueden cargar bobinas hasta definirla."
                : `Hay ${sinMedida.length} máquinas sin medida cargada: no se les pueden cargar bobinas hasta definirlas.`}
            </window.App.Aviso>
          )}
        </div>

        {maquinas.length === 0 ? (
          <div className="panel">
            <div className="vacio">
              No hay máquinas cargadas. Andá a Configuración y cargalas con su número.
            </div>
          </div>
        ) : (
          maquinas.map((m) => (
            <FilaMaquina
              key={m.id}
              maquina={m}
              produccion={
                produccion[m.numero === null ? m.nombre : m.numero]
              }
              alGuardar={cargar}
            />
          ))
        )}
      </div>
    );
  }

  window.App.PantallaMaquinas = Maquinas;
})();

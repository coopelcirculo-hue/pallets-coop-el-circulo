/**
 * Tablero de máquinas: qué está haciendo cada una y cuánto lleva en la jornada.
 *
 * Es la foto de la planta de un vistazo. Con más de diez extrusoras, saber qué
 * está corriendo cada una es la mitad del trabajo del responsable.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  function FilaMaquina({ maquina, produccion, alGuardar }) {
    const [editando, setEditando] = useState(false);

    const p = produccion || { bobinas: 0, kilos: 0, metros: 0 };
    const c = maquina.corrida;
    const detalle = c ? window.App.bobinas.materialYColor(c) : "";
    const aditivos = c ? window.App.bobinas.aditivosDeCorrida(c) : "";

    return (
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
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

          <div style={{ flex: "1 1 220px" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>
              {maquina.nombre}
            </p>

            {c ? (
              <>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                  {window.App.bobinas.medida(c)}
                </p>
                {detalle && (
                  <p style={{ margin: 0, fontSize: 16, color: "var(--tinta-suave)" }}>{detalle}</p>
                )}
                {aditivos && (
                  <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--acento)" }}>
                    + {aditivos}
                  </p>
                )}
                {c.observaciones && (
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--tinta-tenue)" }}>
                    {c.observaciones}
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 18, color: "var(--aviso)", fontWeight: 600 }}>
                Sin producto cargado
              </p>
            )}
          </div>

          <div style={{ textAlign: "right", minWidth: 130 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>En la jornada</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {window.App.zpl.kilosLegibles(p.kilos)} kg
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-suave)" }}>
              {p.bobinas} {p.bobinas === 1 ? "bobina" : "bobinas"}
              {p.metros > 0 && ` · ${window.App.zpl.kilosLegibles(p.metros)} m`}
            </p>
          </div>

          {!editando && (
            <button className="boton chico secundario" onClick={() => setEditando(true)}>
              {c ? "Cambiar" : "Cargar producto"}
            </button>
          )}
        </div>

        {editando && (
          <window.App.EditorCorrida
            maquina={maquina}
            alGuardar={async () => {
              setEditando(false);
              await alGuardar();
            }}
            alCancelar={() => setEditando(false)}
          />
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
          const actual = porMaquina[clave] || { bobinas: 0, kilos: 0, metros: 0 };
          actual.bobinas += 1;
          actual.kilos += Number(b.kilos) || 0;
          actual.metros += Number(b.metros) || 0;
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

    const sinProducto = maquinas.filter((m) => !m.corrida);
    // Sin número no se puede armar el número de bobina ("06-00123").
    const sinNumero = maquinas.filter((m) => m.numero === null || m.numero === undefined);

    return (
      <div>
        <div className="panel">
          <h1>🛠️ Máquinas</h1>
          <p className="subtitulo">
            Qué está produciendo cada extrusora ahora mismo. Al cargar una bobina, la medida, el
            material, el color y los aditivos salen de acá.
          </p>

          {sinNumero.length > 0 && (
            <window.App.Aviso tipo="error">
              Sin número no se pueden cargar bobinas, porque el número de máquina forma parte
              del número de bobina. Cargáselo en Configuración a:{" "}
              {sinNumero.map((m) => m.nombre).join(", ")}.
            </window.App.Aviso>
          )}

          {sinProducto.length > 0 && (
            <window.App.Aviso tipo="atencion">
              {sinProducto.length === 1
                ? "Hay 1 máquina sin producto cargado: no se le pueden cargar bobinas hasta definirlo."
                : `Hay ${sinProducto.length} máquinas sin producto cargado: no se les pueden cargar bobinas hasta definirlo.`}
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
              produccion={produccion[m.numero === null ? m.nombre : m.numero]}
              alGuardar={cargar}
            />
          ))
        )}
      </div>
    );
  }

  window.App.PantallaMaquinas = Maquinas;
})();

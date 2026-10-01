/**
 * Editor de lo que está produciendo una máquina.
 *
 * Lo usan la pantalla de Máquinas y la de Nueva bobina. Está en un solo lugar
 * porque son seis datos y mantener dos formularios iguales termina en que uno
 * de los dos se olvida un campo.
 *
 * Guardar acá cambia lo que produce la máquina para TODAS las bobinas que
 * vengan, no solo para una.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  /*
    Cada fila de aditivo lleva una clave propia en vez de identificarse por su
    posición en la lista. No es un detalle: borrando por posición, si se tocan
    dos ✕ seguidos, el primero corre los índices y el segundo termina apuntando
    a una fila que ya no existe. Resultado: se borraba una sola.
  */
  let ultimaClave = 0;
  const nuevaFila = (datos) => ({ clave: "a" + ++ultimaClave, ...datos });

  function EditorCorrida({ maquina, alGuardar, alCancelar }) {
    const corrida = maquina.corrida;

    const [cat, setCat] = useState(null);
    const [ancho, setAncho] = useState(corrida ? String(corrida.ancho_cm) : "");
    const [micrones, setMicrones] = useState(corrida ? String(corrida.micrones) : "");
    const [fuelle, setFuelle] = useState(
      corrida && corrida.ancho_fuelle_cm ? String(corrida.ancho_fuelle_cm) : "",
    );
    const [materialId, setMaterialId] = useState(corrida ? corrida.material_id || "" : "");
    const [colorId, setColorId] = useState(corrida ? corrida.color_id || "" : "");
    const [observaciones, setObservaciones] = useState(
      corrida ? corrida.observaciones || "" : "",
    );

    // [{ clave, aditivoId, gramosPorKilo }]
    const [aditivos, setAditivos] = useState(
      corrida && corrida.corridas_aditivos
        ? corrida.corridas_aditivos.map((ca) =>
            nuevaFila({
              aditivoId: ca.aditivo_id,
              gramosPorKilo: String(ca.gramos_por_kilo),
            }),
          )
        : [],
    );

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
      window.App.bobinas
        .catalogos()
        .then(setCat)
        .catch((e) => setError(e.message));
    }, []);

    function cambiarAditivo(clave, campo, valor) {
      setAditivos((actuales) =>
        actuales.map((a) => (a.clave === clave ? { ...a, [campo]: valor } : a)),
      );
    }

    function agregarAditivo() {
      setAditivos((actuales) =>
        actuales.concat([nuevaFila({ aditivoId: "", gramosPorKilo: "" })]),
      );
    }

    function quitarAditivo(clave) {
      setAditivos((actuales) => actuales.filter((a) => a.clave !== clave));
    }

    async function guardar() {
      if (guardando) return;

      const a = parseFloat(ancho);
      const mic = parseFloat(micrones);
      if (isNaN(a) || a <= 0) return setError("El ancho tiene que ser mayor a cero.");
      if (isNaN(mic) || mic <= 0) return setError("Los micrones tienen que ser mayores a cero.");

      let f = null;
      if (fuelle !== "") {
        f = parseFloat(fuelle);
        if (isNaN(f) || f <= 0) return setError("El fuelle tiene que ser mayor a cero, o vacío.");
      }

      // Los aditivos a medio cargar se descartan; los mal cargados frenan.
      const cargados = aditivos.filter((x) => x.aditivoId || x.gramosPorKilo !== "");
      for (let i = 0; i < cargados.length; i++) {
        if (!cargados[i].aditivoId) return setError(`Elegí el aditivo de la fila ${i + 1}.`);
        const g = parseFloat(cargados[i].gramosPorKilo);
        if (isNaN(g) || g <= 0) {
          return setError(`La dosis de la fila ${i + 1} tiene que ser mayor a cero.`);
        }
      }

      const repetidos = new Set(cargados.map((x) => x.aditivoId));
      if (repetidos.size !== cargados.length) {
        return setError("Hay un aditivo cargado dos veces.");
      }

      setGuardando(true);
      setError("");

      try {
        const nueva = await window.App.bobinas.definirCorrida({
          maquinaId: maquina.id,
          anchoCm: a,
          micrones: mic,
          anchoFuelleCm: f,
          materialId,
          colorId,
          observaciones,
        });

        await window.App.bobinas.definirAditivos(
          nueva.id,
          cargados.map((x) => ({
            aditivoId: x.aditivoId,
            gramosPorKilo: parseFloat(x.gramosPorKilo),
          })),
        );

        await alGuardar();
      } catch (e) {
        setError(e.message);
      } finally {
        setGuardando(false);
      }
    }

    if (!cat && !error) return <div className="cargando">Cargando listas…</div>;

    return (
      <div style={{ marginTop: 14 }}>
        <window.App.Aviso tipo="error">{error}</window.App.Aviso>

        {cat && (
          <>
            <div className="fila">
              <div className="campo">
                <label>Ancho (cm) *</label>
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
                <label>Fuelle (cm)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={fuelle}
                  onChange={(e) => setFuelle(e.target.value)}
                  placeholder="Vacío si no lleva"
                />
              </div>
              <div className="campo">
                <label>Micrones *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={micrones}
                  onChange={(e) => setMicrones(e.target.value)}
                  placeholder="40"
                />
              </div>
            </div>

            <div className="fila">
              <div className="campo">
                <label>Material</label>
                <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                  <option value="">Sin especificar</option>
                  {cat.materiales.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label>Color</label>
                <select value={colorId} onChange={(e) => setColorId(e.target.value)}>
                  <option value="">Sin especificar</option>
                  {cat.colores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="campo">
              <label>Aditivos y dosis</label>
              <p className="subtitulo" style={{ margin: "0 0 8px" }}>
                Master, protección UV, carga… Pueden ir varios a la vez, cada uno con sus
                gramos por kilo.
              </p>

              {aditivos.length === 0 && (
                <p style={{ color: "var(--tinta-tenue)", margin: "0 0 8px" }}>
                  Esta corrida no lleva aditivos.
                </p>
              )}

              {aditivos.map((a) => (
                <div className="fila" key={a.clave} style={{ marginBottom: 8 }}>
                  <select
                    value={a.aditivoId}
                    onChange={(e) => cambiarAditivo(a.clave, "aditivoId", e.target.value)}
                  >
                    <option value="">Elegir aditivo…</option>
                    {cat.aditivos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={a.gramosPorKilo}
                    onChange={(e) => cambiarAditivo(a.clave, "gramosPorKilo", e.target.value)}
                    placeholder="g por kg"
                  />
                  <button
                    className="boton chico secundario"
                    style={{ flex: "0 0 auto" }}
                    onClick={() => quitarAditivo(a.clave)}
                    title="Quitar"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button className="boton chico secundario" onClick={agregarAditivo}>
                ✚ Agregar aditivo
              </button>
            </div>

            <div className="campo">
              <label>Observaciones de la corrida</label>
              <input
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Opcional: pedido, cliente, lo que haga falta"
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="boton" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar lo que está haciendo"}
              </button>
              {alCancelar && (
                <button className="boton secundario" onClick={alCancelar}>
                  Cancelar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  window.App.EditorCorrida = EditorCorrida;
})();

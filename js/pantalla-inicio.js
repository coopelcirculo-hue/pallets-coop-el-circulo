/**
 * Inicio: cómo viene la jornada.
 *
 * Sin gráficos: números grandes que se leen de un vistazo desde lejos, que es
 * como se mira una tablet apoyada en la mesa de la planta.
 *
 * Trabaja sobre la JORNADA DE PRODUCCIÓN, no sobre el día del calendario. Una
 * bobina hecha a las 02:00 en el turno noche suma al día en que ese turno
 * arrancó; si no, la producción de la noche aparecería partida en dos fechas.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  /**
   * La fecha de HOY en horario argentino.
   *
   * No se usa new Date().toISOString(), que da la fecha UTC: a las 21:30 de
   * Argentina ya son las 00:30 del día siguiente en UTC.
   */
  function hoyArgentina() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()); // en-CA da directamente AAAA-MM-DD
  }

  /** Suma kilos por una clave y devuelve la que más tiene. */
  function elQueMas(filas, sacarNombre) {
    const suma = new Map();
    filas.forEach((f) => {
      const nombre = sacarNombre(f);
      if (nombre === null || nombre === undefined || nombre === "") return;
      const actual = suma.get(nombre) || { kilos: 0, bobinas: 0 };
      actual.kilos += Number(f.kilos) || 0;
      actual.bobinas += 1;
      suma.set(nombre, actual);
    });

    let mejor = null;
    suma.forEach((v, nombre) => {
      if (!mejor || v.kilos > mejor.kilos) mejor = { nombre, ...v };
    });
    return mejor;
  }

  function Numero({ rotulo, valor, detalle, destacado }) {
    return (
      <div
        style={{
          flex: "1 1 190px",
          background: "var(--panel)",
          borderRadius: "var(--radio)",
          boxShadow: "var(--sombra)",
          padding: 18,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--tinta-tenue)",
          }}
        >
          {rotulo}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: destacado ? 44 : 30,
            fontWeight: 800,
            lineHeight: 1.1,
            wordBreak: "break-word",
          }}
        >
          {valor}
        </p>
        {detalle && (
          <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--tinta-suave)" }}>{detalle}</p>
        )}
      </div>
    );
  }

  function Inicio({ irA }) {
    const [bobinas, setBobinas] = useState(null);
    const [error, setError] = useState("");
    const jornada = hoyArgentina();

    useEffect(() => {
      (async () => {
        try {
          setBobinas(await window.App.bobinas.deLaJornada(jornada));
        } catch (e) {
          setError(e.message);
        }
      })();
    }, [jornada]);

    if (error) {
      return (
        <div className="panel">
          <window.App.Aviso tipo="error">{error}</window.App.Aviso>
        </div>
      );
    }

    if (!bobinas) return <div className="cargando">Cargando…</div>;

    const miles = (n) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });

    const kilos = bobinas.reduce((t, b) => t + (Number(b.kilos) || 0), 0);
    const operario = elQueMas(bobinas, (b) => b.operarios && b.operarios.nombre);
    const maquina = elQueMas(bobinas, (b) => window.App.bobinas.numeroMaquina(b.maquinas));
    const medidas = new Set(bobinas.map((b) => window.App.bobinas.medida(b)));

    const porTurno = { Día: 0, Noche: 0 };
    bobinas.forEach((b) => {
      porTurno[b.turno] = (porTurno[b.turno] || 0) + (Number(b.kilos) || 0);
    });

    // Bobinas registradas cuya etiqueta no salió: son las que faltan pegar.
    const sinImprimir = bobinas.filter(
      (b) => b.estado_impresion === "error" || b.estado_impresion === "pendiente",
    );

    const fechaCruda = new Date(jornada + "T12:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const fechaLinda = fechaCruda.charAt(0).toUpperCase() + fechaCruda.slice(1);

    return (
      <div>
        <div className="panel">
          <h1>🏠 Jornada de hoy</h1>
          <p className="subtitulo" style={{ margin: 0 }}>
            {fechaLinda} · incluye el turno noche que arranca hoy
          </p>
        </div>

        {sinImprimir.length > 0 && (
          <div className="panel" style={{ borderLeft: "5px solid var(--aviso)" }}>
            <h2 style={{ marginBottom: 6 }}>
              {sinImprimir.length === 1
                ? "Hay 1 bobina sin etiqueta"
                : `Hay ${sinImprimir.length} bobinas sin etiqueta`}
            </h2>
            <p className="subtitulo">
              Están registradas, pero la etiqueta no llegó a imprimirse:{" "}
              {sinImprimir.map((b) => b.numero_bobina).join(", ")}.
            </p>
            {irA && (
              <button className="boton" onClick={() => irA("reimpresion")}>
                Ir a Reimpresión
              </button>
            )}
          </div>
        )}

        {bobinas.length === 0 ? (
          <div className="panel">
            <div className="vacio">Todavía no se cargó ninguna bobina en esta jornada.</div>
            {irA && (
              <button className="boton ancho" onClick={() => irA("bobina")}>
                Cargar la primera
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <Numero rotulo="Bobinas" valor={bobinas.length} destacado />
              <Numero rotulo="Kilos producidos" valor={miles(kilos) + " kg"} destacado />
              {/* Dos tarjetas y no una: con una sola, el turno que todavía no
                  arrancó mostraba un 0 grande y el otro turno en letra chica. */}
              <Numero rotulo="Turno día" valor={miles(porTurno["Día"] || 0) + " kg"} />
              <Numero rotulo="Turno noche" valor={miles(porTurno["Noche"] || 0) + " kg"} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Numero
                rotulo="Operario más productivo"
                valor={operario ? operario.nombre : "—"}
                detalle={
                  operario
                    ? `${miles(operario.kilos)} kg en ${operario.bobinas} ${operario.bobinas === 1 ? "bobina" : "bobinas"}`
                    : null
                }
              />
              <Numero
                rotulo="Máquina con más producción"
                valor={maquina ? "Nº " + maquina.nombre : "—"}
                detalle={
                  maquina
                    ? `${miles(maquina.kilos)} kg en ${maquina.bobinas} ${maquina.bobinas === 1 ? "bobina" : "bobinas"}`
                    : null
                }
              />
              <Numero
                rotulo="Medidas distintas"
                valor={medidas.size}
                detalle={[...medidas].slice(0, 3).join(" · ")}
              />
            </div>

            <div className="panel" style={{ marginTop: 16 }}>
              <h2>Últimas bobinas</h2>
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Bobina</th>
                      <th>Medida</th>
                      <th>Máq.</th>
                      <th>Op.</th>
                      <th>Turno</th>
                      <th style={{ textAlign: "right" }}>Kilos</th>
                      <th>Impresión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bobinas.slice(0, 10).map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700 }}>{b.numero_bobina}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{window.App.bobinas.medida(b)}</td>
                        <td>{window.App.bobinas.numeroMaquina(b.maquinas)}</td>
                        <td>{b.operarios ? b.operarios.iniciales : "—"}</td>
                        <td>{b.turno}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {window.App.zpl.kilosLegibles(b.kilos)} kg
                        </td>
                        <td>
                          <window.App.EstadoPallet estado={b.estado_impresion} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  window.App.PantallaInicio = Inicio;
  window.App.hoyArgentina = hoyArgentina;
})();

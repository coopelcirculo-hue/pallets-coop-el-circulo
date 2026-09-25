/**
 * Inicio: cómo viene el día.
 *
 * Sin gráficos: números grandes que se leen de un vistazo desde lejos, que es
 * como se mira una tablet apoyada en la mesa de la planta.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  /**
   * La fecha de HOY en horario argentino.
   *
   * No se usa new Date().toISOString(), que da la fecha UTC: a las 21:30 de
   * Argentina ya son las 00:30 del día siguiente en UTC, y el turno noche
   * aparecería en el día equivocado. Es el mismo cuidado que en la base.
   */
  function hoyArgentina() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()); // en-CA da directamente AAAA-MM-DD
  }

  /** Suma kilos por una clave y devuelve el que más tiene. */
  function elQueMas(pallets, sacarNombre) {
    const suma = new Map();
    pallets.forEach((p) => {
      const nombre = sacarNombre(p);
      if (!nombre) return;
      const actual = suma.get(nombre) || { kilos: 0, pallets: 0 };
      actual.kilos += Number(p.peso_total) || 0;
      actual.pallets += 1;
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
        <p style={{ margin: 0, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--tinta-tenue)" }}>
          {rotulo}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: destacado ? 44 : 34,
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
    const [pallets, setPallets] = useState(null);
    const [error, setError] = useState("");
    const fecha = hoyArgentina();

    useEffect(() => {
      (async () => {
        const { data, error } = await window.App.db
          .from("pallets")
          .select(
            "id, numero_pallet, peso_total, estado_impresion," +
              " clientes(nombre), operarios(nombre, iniciales), maquinas(nombre)",
          )
          .eq("fecha", fecha)
          .order("creado_en", { ascending: false });

        if (error) setError(window.App.ui.mensajeDeError(error));
        else setPallets(data || []);
      })();
    }, [fecha]);

    if (error) {
      return (
        <div className="panel">
          <window.App.Aviso tipo="error">{error}</window.App.Aviso>
        </div>
      );
    }

    if (!pallets) return <div className="cargando">Cargando…</div>;

    const kilos = pallets.reduce((t, p) => t + (Number(p.peso_total) || 0), 0);
    const operario = elQueMas(pallets, (p) => p.operarios && p.operarios.nombre);
    const maquina = elQueMas(pallets, (p) => p.maquinas && p.maquinas.nombre);
    const clientes = new Set(
      pallets.map((p) => p.clientes && p.clientes.nombre).filter(Boolean),
    );

    // Pallets registrados pero cuya etiqueta no salió. Es lo primero que tiene
    // que ver el encargado al abrir la app: son etiquetas que faltan pegar.
    const sinImprimir = pallets.filter(
      (p) => p.estado_impresion === "error" || p.estado_impresion === "pendiente",
    );

    const miles = (n) =>
      Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });

    // Solo la primera letra en mayúscula. Con text-transform de CSS quedaba
    // "Viernes, 25 De Septiembre", que en castellano está mal.
    const fechaCruda = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const fechaLinda = fechaCruda.charAt(0).toUpperCase() + fechaCruda.slice(1);

    return (
      <div>
        <div className="panel">
          <h1>🏠 Hoy</h1>
          <p className="subtitulo" style={{ margin: 0 }}>
            {fechaLinda}
          </p>
        </div>

        {sinImprimir.length > 0 && (
          <div className="panel" style={{ borderLeft: "5px solid var(--aviso)" }}>
            <h2 style={{ marginBottom: 6 }}>
              {sinImprimir.length === 1
                ? "Hay 1 pallet sin etiqueta"
                : `Hay ${sinImprimir.length} pallets sin etiqueta`}
            </h2>
            <p className="subtitulo">
              Están registrados, pero la etiqueta no llegó a imprimirse:{" "}
              {sinImprimir.map((p) => p.numero_pallet).join(", ")}.
            </p>
            {irA && (
              <button className="boton" onClick={() => irA("reimpresion")}>
                Ir a Reimpresión
              </button>
            )}
          </div>
        )}

        {pallets.length === 0 ? (
          <div className="panel">
            <div className="vacio">Todavía no se cargó ningún pallet hoy.</div>
            {irA && (
              <button className="boton ancho" onClick={() => irA("nuevo")}>
                Cargar el primero
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <Numero rotulo="Pallets" valor={pallets.length} destacado />
              <Numero rotulo="Kilos totales" valor={miles(kilos) + " kg"} destacado />
              <Numero
                rotulo="Clientes atendidos"
                valor={clientes.size}
                detalle={[...clientes].join(", ")}
              />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Numero
                rotulo="Operario más productivo"
                valor={operario ? operario.nombre : "—"}
                detalle={
                  operario
                    ? `${miles(operario.kilos)} kg en ${operario.pallets} ${operario.pallets === 1 ? "pallet" : "pallets"}`
                    : null
                }
              />
              <Numero
                rotulo="Máquina con más producción"
                valor={maquina ? maquina.nombre : "—"}
                detalle={
                  maquina
                    ? `${miles(maquina.kilos)} kg en ${maquina.pallets} ${maquina.pallets === 1 ? "pallet" : "pallets"}`
                    : null
                }
              />
            </div>

            <div className="panel" style={{ marginTop: 16 }}>
              <h2>Últimos pallets de hoy</h2>
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pallet</th>
                      <th>Cliente</th>
                      <th>Operario</th>
                      <th style={{ textAlign: "right" }}>Peso</th>
                      <th>Impresión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pallets.slice(0, 10).map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.numero_pallet}</td>
                        <td>{p.clientes ? p.clientes.nombre : "—"}</td>
                        <td>{p.operarios ? p.operarios.iniciales : "—"}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {miles(p.peso_total)} kg
                        </td>
                        <td>
                          <window.App.EstadoPallet estado={p.estado_impresion} />
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

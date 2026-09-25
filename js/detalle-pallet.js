/**
 * Detalle de un pallet ya creado, con reimpresión.
 * Lo usan Historial (completo) y Reimpresión (sin editar observaciones).
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  function DetallePallet({ palletId, onVolver, permitirEditar }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");

    const [observaciones, setObservaciones] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [avisoObs, setAvisoObs] = useState("");

    const [impresion, setImpresion] = useState(null);

    async function cargar() {
      try {
        const d = await window.App.pallets.detalle(palletId);
        setDatos(d);
        setObservaciones(d.pallet.observaciones || "");
      } catch (e) {
        setError(e.message);
      }
    }

    useEffect(() => {
      cargar();
    }, [palletId]);

    async function guardarObs() {
      if (guardando) return;
      setGuardando(true);
      try {
        await window.App.pallets.guardarObservaciones(palletId, observaciones);
        setAvisoObs("Guardado.");
        setTimeout(() => setAvisoObs(""), 2500);
      } catch (e) {
        setError(e.message);
      } finally {
        setGuardando(false);
      }
    }

    /**
     * Reimprime. Reenvía el ZPL guardado tal cual se generó la primera vez:
     * la etiqueta tiene que salir idéntica a la original aunque desde entonces
     * hayan cambiado la marca o las medidas del formato.
     */
    async function reimprimir(reintentando) {
      setImpresion({ estado: "enviando" });
      try {
        const r = await window.App.impresora.imprimirPallet(palletId, {
          esReimpresion: true,
          reintentarDeteccion: !!reintentando,
        });
        setImpresion({
          estado: r.ok ? "ok" : "error",
          mensaje: r.mensaje,
          zpl: r.zpl,
          disenio: r.disenio,
        });
        cargar(); // para que se vea el nuevo estado y el registro
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

    const { pallet, productos, impresiones } = datos;
    const zplLib = window.App.zpl;

    const dato = (rotulo, valor) => (
      <div style={{ minWidth: 150, flex: "1 1 150px" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>{rotulo}</p>
        <p style={{ margin: 0, fontWeight: 600 }}>{valor || "—"}</p>
      </div>
    );

    const estadoImp = impresion ? impresion.estado : null;

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
              <p style={{ margin: 0, fontSize: 13, color: "var(--tinta-tenue)" }}>Pallet</p>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{pallet.numero_pallet}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <window.App.EstadoPallet estado={pallet.estado_impresion} />
              <button className="boton chico secundario" onClick={onVolver}>
                Volver
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 18 }}>
            {dato("Cliente", pallet.clientes && pallet.clientes.nombre)}
            {dato(
              "Operario",
              pallet.operarios &&
                `${pallet.operarios.nombre} (${pallet.operarios.iniciales})`,
            )}
            {dato("Máquina", pallet.maquinas && pallet.maquinas.nombre)}
            {dato("Turno", pallet.turno)}
            {dato("Fecha", zplLib.fechaLegible(pallet.fecha))}
            {dato("Hora", zplLib.horaLegible(pallet.hora))}
            {dato("Etiqueta", pallet.formatos_etiqueta && pallet.formatos_etiqueta.nombre)}
            {dato("Cargado por", pallet.usuarios && pallet.usuarios.nombre)}
          </div>
        </div>

        <div className="panel">
          <h2>Contenido</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Medida</th>
                  <th>Micrones</th>
                  <th style={{ textAlign: "right" }}>Kilos</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.medida}</td>
                    <td>{p.micrones === null ? "—" : zplLib.kilosLegibles(p.micrones)}</td>
                    <td style={{ textAlign: "right" }}>{zplLib.kilosLegibles(p.kilos)} kg</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="2" style={{ fontWeight: 700 }}>
                    PESO TOTAL
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 18 }}>
                    {zplLib.kilosLegibles(pallet.peso_total)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {permitirEditar && (
          <div className="panel">
            <h2>Observaciones</h2>
            <p className="subtitulo">
              Es lo único editable de un pallet ya creado. El resto es historial de producción.
            </p>
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
            Reenvía la misma etiqueta que se generó la primera vez, aunque después hayan
            cambiado la marca o las medidas.
          </p>

          {estadoImp === "ok" && <window.App.Aviso tipo="ok">Etiqueta enviada.</window.App.Aviso>}
          {estadoImp === "error" && (
            <window.App.Aviso tipo="atencion">
              {/* Se le saca el punto final al mensaje para que no queden dos seguidos. */}
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
              {estadoImp === "enviando" ? "Enviando…" : "Reimprimir etiqueta"}
            </button>

            {impresion && impresion.zpl && (
              <button
                className="boton secundario"
                onClick={() =>
                  window.App.impresora.descargarZpl(impresion.zpl, pallet.numero_pallet)
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
          <h2>Impresiones de este pallet</h2>
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

  window.App.DetallePallet = DetallePallet;
})();

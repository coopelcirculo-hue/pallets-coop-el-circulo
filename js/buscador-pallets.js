/**
 * Buscador de pallets, compartido por Historial y Reimpresión.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  /** Cartelito de color con el estado de impresión. */
  function EstadoPallet({ estado }) {
    const e = window.App.pallets.ESTILO_ESTADO[estado] ||
      window.App.pallets.ESTILO_ESTADO.pendiente;
    return (
      <span className="etiqueta-estado" style={{ background: e.fondo, color: e.letra }}>
        {e.texto}
      </span>
    );
  }

  function BuscadorPallets({ onElegir, ayuda }) {
    const [texto, setTexto] = useState("");
    const [filas, setFilas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
      /*
        Dos cosas importantes acá:

        1. Se espera 250 ms antes de consultar. Sin eso, escribir "458" dispara
           tres consultas y la planta tiene internet de fábrica, no de oficina.
        2. `vigente` descarta la respuesta si el texto ya cambió. Si no, una
           consulta vieja que tarda más puede pisar el resultado de la nueva y
           mostrar lo que no corresponde.
      */
      let vigente = true;
      setCargando(true);

      const reloj = setTimeout(async () => {
        try {
          const r = await window.App.pallets.buscar(texto);
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
          <label>Buscar por número de pallet</label>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="458"
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
              ? `No hay ningún pallet que contenga "${texto.trim()}".`
              : "Todavía no se cargó ningún pallet."}
          </div>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pallet</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Peso</th>
                  <th>Impresión</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.numero_pallet}</td>
                    <td>{p.clientes ? p.clientes.nombre : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {window.App.zpl.fechaLegible(p.fecha)}
                      <br />
                      <span style={{ color: "var(--tinta-tenue)", fontSize: 13 }}>
                        {window.App.zpl.horaLegible(p.hora)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {window.App.zpl.kilosLegibles(p.peso_total)} kg
                    </td>
                    <td>
                      <EstadoPallet estado={p.estado_impresion} />
                    </td>
                    <td>
                      <div className="acciones">
                        <button className="boton chico secundario" onClick={() => onElegir(p)}>
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

  window.App.EstadoPallet = EstadoPallet;
  window.App.BuscadorPallets = BuscadorPallets;
})();

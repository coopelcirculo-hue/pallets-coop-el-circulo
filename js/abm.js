/**
 * ABM genérico para las tablas maestras (clientes, operarios, máquinas, formatos).
 *
 * Todas se manejan igual: listar, agregar, editar y dar de baja. En vez de
 * escribir cuatro pantallas casi iguales, se configura con `campos` y listo.
 *
 * Importante: NUNCA borra físicamente. Las bajas son `activo = false`, porque
 * los pallets viejos siguen apuntando a estas filas y el historial no se toca.
 */

(function () {
  const { useState, useEffect, useCallback } = React;

  function Abm({ titulo, descripcion, tabla, campos, orden, alCambiar, extras }) {
    const [filas, setFilas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [ok, setOk] = useState("");
    const [guardando, setGuardando] = useState(false);

    const vacio = {};
    campos.forEach((c) => {
      vacio[c.nombre] = c.porDefecto !== undefined ? c.porDefecto : "";
    });

    const [nuevo, setNuevo] = useState(vacio);
    const [editandoId, setEditandoId] = useState(null);
    const [edicion, setEdicion] = useState({});

    const cargar = useCallback(async () => {
      setCargando(true);
      const { data, error } = await window.App.db
        .from(tabla)
        .select("*")
        .order(orden || "nombre");

      if (error) setError(window.App.ui.mensajeDeError(error));
      else setFilas(data || []);

      setCargando(false);
    }, [tabla, orden]);

    useEffect(() => {
      cargar();
    }, [cargar]);

    function avisar(mensaje) {
      setOk(mensaje);
      setError("");
      setTimeout(() => setOk(""), 2500);
    }

    /** Convierte los textos del formulario a lo que espera Postgres. */
    function limpiar(valores) {
      const salida = {};
      campos.forEach((c) => {
        let v = valores[c.nombre];
        if (typeof v === "string") v = v.trim();
        // Los <select> devuelven texto: el dpi tiene que viajar como número.
        if (c.tipo === "numero" || c.numerico) v = v === "" ? null : Number(v);
        if (v === "" && !c.requerido) v = null;
        salida[c.nombre] = v;
      });
      return salida;
    }

    function faltaAlgo(valores) {
      return campos.some(
        (c) => c.requerido && (valores[c.nombre] === "" || valores[c.nombre] === null),
      );
    }

    async function agregar(e) {
      e.preventDefault();
      if (guardando) return; // anti doble toque

      const datos = limpiar(nuevo);
      if (faltaAlgo(datos)) {
        setError("Completá los campos obligatorios.");
        return;
      }

      setGuardando(true);
      const { error } = await window.App.db.from(tabla).insert(datos);
      setGuardando(false);

      if (error) {
        setError(window.App.ui.mensajeDeError(error));
        return;
      }

      setNuevo(vacio);
      avisar("Agregado.");
      await cargar();
      if (alCambiar) alCambiar();
    }

    async function guardarEdicion(id) {
      if (guardando) return;

      const datos = limpiar(edicion);
      if (faltaAlgo(datos)) {
        setError("Completá los campos obligatorios.");
        return;
      }

      setGuardando(true);
      const { error } = await window.App.db.from(tabla).update(datos).eq("id", id);
      setGuardando(false);

      if (error) {
        setError(window.App.ui.mensajeDeError(error));
        return;
      }

      setEditandoId(null);
      avisar("Guardado.");
      await cargar();
      if (alCambiar) alCambiar();
    }

    async function cambiarActivo(fila) {
      const { error } = await window.App.db
        .from(tabla)
        .update({ activo: !fila.activo })
        .eq("id", fila.id);

      if (error) {
        setError(window.App.ui.mensajeDeError(error));
        return;
      }

      avisar(fila.activo ? "Dado de baja." : "Reactivado.");
      await cargar();
      if (alCambiar) alCambiar();
    }

    function entrada(campo, valores, setValores) {
      const valor = valores[campo.nombre] === null ? "" : valores[campo.nombre];
      const cambiar = (v) => setValores({ ...valores, [campo.nombre]: v });

      if (campo.tipo === "select") {
        return (
          <select value={valor} onChange={(e) => cambiar(e.target.value)}>
            {campo.opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      }

      return (
        <input
          type={campo.tipo === "numero" ? "number" : "text"}
          inputMode={campo.tipo === "numero" ? "decimal" : undefined}
          step={campo.paso || (campo.tipo === "numero" ? "0.01" : undefined)}
          maxLength={campo.largoMaximo}
          placeholder={campo.etiqueta}
          value={valor}
          onChange={(e) => cambiar(e.target.value)}
        />
      );
    }

    return (
      <div className="panel">
        <h2>{titulo}</h2>
        {descripcion && <p className="subtitulo">{descripcion}</p>}

        <window.App.Aviso tipo="error">{error}</window.App.Aviso>
        <window.App.Aviso tipo="ok">{ok}</window.App.Aviso>

        <form className="fila" onSubmit={agregar} style={{ marginBottom: 18 }}>
          {campos.map((c) => (
            <div key={c.nombre} className="campo" style={{ marginBottom: 0 }}>
              <label>
                {c.etiqueta}
                {c.requerido ? " *" : ""}
              </label>
              {entrada(c, nuevo, setNuevo)}
            </div>
          ))}
          <div className="campo" style={{ marginBottom: 0, flex: "0 0 auto" }}>
            <label>&nbsp;</label>
            <button className="boton" type="submit" disabled={guardando}>
              {guardando ? "…" : "Agregar"}
            </button>
          </div>
        </form>

        {cargando ? (
          <div className="cargando">Cargando…</div>
        ) : filas.length === 0 ? (
          <div className="vacio">Todavía no hay nada cargado.</div>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  {campos.map((c) => (
                    <th key={c.nombre}>{c.etiqueta}</th>
                  ))}
                  {extras && <th>{extras.titulo}</th>}
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const editando = editandoId === fila.id;
                  return (
                    <tr key={fila.id} className={fila.activo === false ? "inactiva" : ""}>
                      {campos.map((c) => (
                        <td key={c.nombre}>
                          {editando
                            ? entrada(c, edicion, setEdicion)
                            : fila[c.nombre] === null || fila[c.nombre] === ""
                              ? "—"
                              : String(fila[c.nombre])}
                        </td>
                      ))}

                      {extras && <td>{extras.render(fila, cargar)}</td>}

                      <td>
                        <div className="acciones">
                          {editando ? (
                            <>
                              <button
                                className="boton chico"
                                onClick={() => guardarEdicion(fila.id)}
                                disabled={guardando}
                              >
                                Guardar
                              </button>
                              <button
                                className="boton chico secundario"
                                onClick={() => setEditandoId(null)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="boton chico secundario"
                                onClick={() => {
                                  setEditandoId(fila.id);
                                  setEdicion({ ...fila });
                                }}
                              >
                                Editar
                              </button>
                              {"activo" in fila && (
                                <button
                                  className="boton chico secundario"
                                  onClick={() => cambiarActivo(fila)}
                                >
                                  {fila.activo ? "Dar de baja" : "Reactivar"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  window.App.Abm = Abm;
})();

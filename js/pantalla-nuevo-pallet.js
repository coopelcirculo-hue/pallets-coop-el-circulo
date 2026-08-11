/**
 * Pantalla "Nuevo pallet": la que se usa todo el día.
 *
 * El objetivo es cargar un pallet en menos de un minuto, así que todo está
 * pensado para minimizar toques: los dropdowns vienen cargados, las medidas
 * frecuentes del cliente aparecen como chips, y el peso total se calcula solo.
 */

window.App = window.App || {};

(function () {
  const { useState, useEffect } = React;

  const TURNOS = ["Mañana", "Tarde", "Noche"];

  /** Fila vacía de producto. */
  const filaVacia = () => ({ medida: "", micrones: "", kilos: "" });

  function NuevoPallet() {
    const [listas, setListas] = useState(null);
    const [errorCarga, setErrorCarga] = useState("");

    const [clienteId, setClienteId] = useState("");
    const [operarioId, setOperarioId] = useState("");
    const [maquinaId, setMaquinaId] = useState("");
    const [formatoId, setFormatoId] = useState("");
    const [turno, setTurno] = useState(TURNOS[0]);
    const [observaciones, setObservaciones] = useState("");

    const [plantillas, setPlantillas] = useState([]);
    const [productos, setProductos] = useState([filaVacia()]);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [creado, setCreado] = useState(null);

    /* --- Carga inicial de los desplegables ------------------------------- */

    useEffect(() => {
      (async () => {
        const db = window.App.db;
        const [clientes, operarios, maquinas, formatos] = await Promise.all([
          db.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
          db.from("operarios").select("id, nombre, iniciales").eq("activo", true).order("nombre"),
          db.from("maquinas").select("id, nombre").eq("activo", true).order("nombre"),
          db
            .from("formatos_etiqueta")
            .select("id, nombre, predeterminado")
            .eq("activo", true)
            .order("nombre"),
        ]);

        const fallo = [clientes, operarios, maquinas, formatos].find((r) => r.error);
        if (fallo) {
          setErrorCarga(window.App.ui.mensajeDeError(fallo.error));
          return;
        }

        setListas({
          clientes: clientes.data,
          operarios: operarios.data,
          maquinas: maquinas.data,
          formatos: formatos.data,
        });

        // El formato marcado como predeterminado viene elegido de entrada.
        const porDefecto = formatos.data.find((f) => f.predeterminado);
        if (porDefecto) setFormatoId(porDefecto.id);
      })();
    }, []);

    /* --- Medidas frecuentes del cliente elegido -------------------------- */

    useEffect(() => {
      if (!clienteId) {
        setPlantillas([]);
        return;
      }
      window.App.db
        .from("plantillas_cliente")
        .select("id, medida")
        .eq("cliente_id", clienteId)
        .order("medida")
        .then(({ data }) => setPlantillas(data || []));
    }, [clienteId]);

    /* --- Manejo de las filas de producto --------------------------------- */

    /*
      Las tres funciones de abajo actualizan con la forma funcional
      —setProductos(actuales => ...)— y no leyendo `productos` directo.

      No es capricho: React junta varias actualizaciones seguidas en una sola
      pasada, y si se lee la variable del cierre, dos toques rápidos leen el
      mismo estado viejo y el segundo pisa al primero. Tocando tres chips
      seguidos quedaba UNA fila en vez de tres.
    */

    function cambiarProducto(indice, clave, valor) {
      setProductos((actuales) => {
        const copia = actuales.slice();
        copia[indice] = { ...copia[indice], [clave]: valor };
        return copia;
      });
    }

    /** true si la fila no tiene nada cargado todavía. */
    const estaVacia = (p) => p.medida.trim() === "" && p.kilos === "" && p.micrones === "";

    /**
     * Agrega una fila. Si viene de un chip y hay una fila vacía dando vueltas,
     * la aprovecha en vez de sumar otra: si no, el operario tendría que borrar
     * a mano la fila vacía que quedó arriba.
     */
    function agregarFila(medida) {
      setProductos((actuales) => {
        if (medida) {
          const libre = actuales.findIndex(estaVacia);
          if (libre !== -1) {
            const copia = actuales.slice();
            copia[libre] = { ...copia[libre], medida };
            return copia;
          }
        }
        return actuales.concat([{ ...filaVacia(), medida: medida || "" }]);
      });
    }

    function quitarFila(indice) {
      setProductos((actuales) => {
        const copia = actuales.filter((_, i) => i !== indice);
        return copia.length ? copia : [filaVacia()];
      });
    }

    /** Suma de kilos. Ignora lo que todavía no es un número. */
    const pesoTotal = productos.reduce((total, p) => {
      const k = parseFloat(p.kilos);
      return total + (isNaN(k) ? 0 : k);
    }, 0);

    /* --- Guardar --------------------------------------------------------- */

    function validar() {
      if (!clienteId) return "Elegí el cliente.";
      if (!operarioId) return "Elegí el operario.";
      if (!maquinaId) return "Elegí la máquina.";

      if (productos.every(estaVacia)) return "Cargá al menos un producto.";

      // Se recorre sobre la lista completa para que el número de fila del
      // mensaje coincida con el que el operario ve en pantalla.
      for (let i = 0; i < productos.length; i++) {
        const p = productos[i];
        if (estaVacia(p)) continue;
        if (!p.medida.trim()) return `Falta la medida en la fila ${i + 1}.`;
        const k = parseFloat(p.kilos);
        if (isNaN(k) || k <= 0) return `Los kilos de la fila ${i + 1} no son válidos.`;
      }
      return null;
    }

    async function crear() {
      if (guardando) return; // anti doble toque

      const problema = validar();
      if (problema) {
        setError(problema);
        return;
      }

      setGuardando(true);
      setError("");

      const aEnviar = productos
        .filter((p) => p.medida.trim() !== "")
        .map((p) => ({
          medida: p.medida.trim(),
          micrones: p.micrones === "" ? null : p.micrones,
          kilos: p.kilos,
        }));

      // Una sola llamada: la función de Postgres guarda el pallet y sus
      // productos adentro de una transacción. O entra todo, o no entra nada.
      const { data, error } = await window.App.db.rpc("crear_pallet", {
        p_cliente_id: clienteId,
        p_operario_id: operarioId,
        p_maquina_id: maquinaId,
        p_turno: turno,
        p_observaciones: observaciones,
        p_formato_etiqueta_id: formatoId || null,
        p_productos: aEnviar,
      });

      setGuardando(false);

      if (error) {
        setError(window.App.ui.mensajeDeError(error));
        return;
      }

      setCreado(data);
    }

    function otroPallet() {
      // Se mantienen operario, máquina y turno: casi siempre es el mismo
      // durante todo el turno, y ahorra tres toques por pallet.
      setCreado(null);
      setProductos([filaVacia()]);
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

    if (!listas) return <div className="cargando">Cargando…</div>;

    if (listas.clientes.length === 0 || listas.operarios.length === 0 || listas.maquinas.length === 0) {
      return (
        <div className="panel">
          <h1>📦 Nuevo pallet</h1>
          <window.App.Aviso tipo="atencion">
            Faltan datos para poder cargar un pallet. Andá a Configuración y cargá al menos un
            cliente, un operario y una máquina.
          </window.App.Aviso>
        </div>
      );
    }

    // Pantalla de confirmación después de crear
    if (creado) {
      return (
        <div className="panel" style={{ textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "var(--tinta-suave)", margin: 0 }}>Pallet creado</p>
          <p style={{ fontSize: 44, fontWeight: 800, margin: "6px 0" }}>{creado.numero_pallet}</p>
          <p style={{ fontSize: 20, margin: "0 0 6px" }}>{Number(creado.peso_total)} kg</p>
          <span className="etiqueta-estado no">Pendiente de impresión</span>

          <window.App.Aviso tipo="atencion">
            La impresión automática se conecta en la Etapa 5. El pallet ya quedó registrado y se
            puede imprimir después desde Reimpresión.
          </window.App.Aviso>

          <button className="boton ancho" onClick={otroPallet}>
            Cargar otro pallet
          </button>
        </div>
      );
    }

    return (
      <div>
        <div className="panel">
          <h1>📦 Nuevo pallet</h1>

          <window.App.Aviso tipo="error">{error}</window.App.Aviso>

          <div className="fila">
            <div className="campo">
              <label>Cliente *</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Elegir…</option>
                {listas.clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>Operario *</label>
              <select value={operarioId} onChange={(e) => setOperarioId(e.target.value)}>
                <option value="">Elegir…</option>
                {listas.operarios.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.iniciales})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="fila">
            <div className="campo">
              <label>Máquina *</label>
              <select value={maquinaId} onChange={(e) => setMaquinaId(e.target.value)}>
                <option value="">Elegir…</option>
                {listas.maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>Turno *</label>
              <select value={turno} onChange={(e) => setTurno(e.target.value)}>
                {TURNOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>Etiqueta</label>
              <select value={formatoId} onChange={(e) => setFormatoId(e.target.value)}>
                <option value="">Sin definir</option>
                {listas.formatos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="campo">
            <label>Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="panel">
          <h2>Contenido</h2>

          {plantillas.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p className="subtitulo" style={{ marginBottom: 8 }}>
                Medidas de este cliente — tocá para agregar la fila:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {plantillas.map((p) => (
                  <button
                    key={p.id}
                    className="boton chico secundario"
                    onClick={() => agregarFila(p.medida)}
                  >
                    ✚ {p.medida}
                  </button>
                ))}
              </div>
            </div>
          )}

          {productos.map((p, i) => (
            <div className="fila" key={i} style={{ marginBottom: 10, alignItems: "flex-end" }}>
              <div className="campo" style={{ marginBottom: 0 }}>
                <label>Medida</label>
                <input
                  value={p.medida}
                  onChange={(e) => cambiarProducto(i, "medida", e.target.value)}
                  placeholder="45x60"
                />
              </div>
              <div className="campo" style={{ marginBottom: 0 }}>
                <label>Micrones</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={p.micrones}
                  onChange={(e) => cambiarProducto(i, "micrones", e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="campo" style={{ marginBottom: 0 }}>
                <label>Kilos *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={p.kilos}
                  onChange={(e) => cambiarProducto(i, "kilos", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="campo" style={{ marginBottom: 0, flex: "0 0 auto" }}>
                <label>&nbsp;</label>
                <button
                  className="boton chico secundario"
                  onClick={() => quitarFila(i)}
                  title="Quitar fila"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <button className="boton secundario" onClick={() => agregarFila()}>
            ✚ Agregar producto
          </button>
        </div>

        <div className="panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 17, color: "var(--tinta-suave)" }}>Peso total</span>
            <strong style={{ fontSize: 34 }}>
              {pesoTotal.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg
            </strong>
          </div>

          <button className="boton ancho" onClick={crear} disabled={guardando}>
            {guardando ? "Creando…" : "Crear pallet"}
          </button>
        </div>
      </div>
    );
  }

  window.App.PantallaNuevoPallet = NuevoPallet;
})();

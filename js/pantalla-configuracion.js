/**
 * Pantalla de Configuración: todo lo que se carga una vez y después se usa
 * en el resto del sistema.
 */

(function () {
  const { useState, useEffect } = React;

  /* -------------------------------------------------------------------------
     Marca de la etiqueta y datos de la impresora.
     Es una sola fila en la tabla configuracion (id = 1).
     ------------------------------------------------------------------------- */

  function Marca() {
    const [datos, setDatos] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [ok, setOk] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
      window.App.db
        .from("configuracion")
        .select("*")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) setError(window.App.ui.mensajeDeError(error));
          else setDatos(data || {});
        });
    }, []);

    async function guardar(e) {
      e.preventDefault();
      if (guardando) return;

      setGuardando(true);
      setError("");

      const { error } = await window.App.db
        .from("configuracion")
        .update({
          marca_principal: (datos.marca_principal || "").trim(),
          marca_secundaria: (datos.marca_secundaria || "").trim() || null,
          nombre_impresora: (datos.nombre_impresora || "").trim() || null,
          impresora_dpi: Number(datos.impresora_dpi) || 203,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", 1);

      setGuardando(false);

      if (error) {
        setError(window.App.ui.mensajeDeError(error));
        return;
      }

      setOk("Guardado.");
      setTimeout(() => setOk(""), 2500);
    }

    if (!datos) return <div className="panel cargando">Cargando…</div>;

    const campo = (clave, valor) => setDatos({ ...datos, [clave]: valor });

    return (
      <form className="panel" onSubmit={guardar}>
        <h2>Marca e impresora</h2>
        <p className="subtitulo">
          La marca es lo que sale impreso arriba de todo. Se puede cambiar cuando quieran, sin
          tocar el sistema.
        </p>

        <window.App.Aviso tipo="error">{error}</window.App.Aviso>
        <window.App.Aviso tipo="ok">{ok}</window.App.Aviso>

        <div className="fila">
          <div className="campo">
            <label>Nombre principal *</label>
            <input
              value={datos.marca_principal || ""}
              onChange={(e) => campo("marca_principal", e.target.value)}
              placeholder="COOP EL CIRCULO"
              required
            />
          </div>

          <div className="campo">
            <label>Línea secundaria</label>
            <input
              value={datos.marca_secundaria || ""}
              onChange={(e) => campo("marca_secundaria", e.target.value)}
              placeholder="Sistema TD Studio"
            />
          </div>
        </div>

        <div className="fila">
          <div className="campo">
            <label>Nombre de la impresora</label>
            <input
              value={datos.nombre_impresora || ""}
              onChange={(e) => campo("nombre_impresora", e.target.value)}
              placeholder="El que muestra Zebra Browser Print"
            />
          </div>

          <div className="campo">
            <label>Resolución del cabezal (dpi)</label>
            <select
              value={datos.impresora_dpi || 203}
              onChange={(e) => campo("impresora_dpi", e.target.value)}
            >
              <option value="203">203 dpi</option>
              <option value="300">300 dpi</option>
            </select>
            <p className="subtitulo" style={{ margin: "6px 0 0", fontSize: 13 }}>
              Es de la impresora, no de la etiqueta. Está en la etiqueta del modelo:
              ZD4A<strong>042</strong> es 203 dpi y ZD4A<strong>043</strong> es 300 dpi. Si te
              equivocás, todo sale impreso a otra escala.
            </p>
          </div>
        </div>

        <button className="boton" type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </form>
    );
  }

  /* -------------------------------------------------------------------------
     Medidas frecuentes de cada cliente.
     Son los chips que van a aparecer al cargar un pallet (Etapa 4), para no
     tener que escribir "45x60" a mano cada vez.
     ------------------------------------------------------------------------- */

  function PlantillasCliente({ cliente }) {
    const [medidas, setMedidas] = useState([]);
    const [nueva, setNueva] = useState("");
    const [abierto, setAbierto] = useState(false);

    async function cargar() {
      const { data } = await window.App.db
        .from("plantillas_cliente")
        .select("id, medida")
        .eq("cliente_id", cliente.id)
        .order("medida");
      setMedidas(data || []);
    }

    useEffect(() => {
      if (abierto) cargar();
    }, [abierto]);

    async function agregar() {
      const medida = nueva.trim();
      if (!medida) return;

      await window.App.db
        .from("plantillas_cliente")
        .insert({ cliente_id: cliente.id, medida });

      setNueva("");
      cargar();
    }

    async function quitar(id) {
      await window.App.db.from("plantillas_cliente").delete().eq("id", id);
      cargar();
    }

    if (!abierto) {
      return (
        <button className="boton chico secundario" onClick={() => setAbierto(true)}>
          Ver medidas
        </button>
      );
    }

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {medidas.length === 0 && <span style={{ color: "var(--tinta-tenue)" }}>Ninguna</span>}
          {medidas.map((m) => (
            <span key={m.id} className="etiqueta-estado si">
              {m.medida}{" "}
              <button
                onClick={() => quitar(m.id)}
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  color: "inherit",
                  fontWeight: 700,
                }}
                title="Quitar"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="45x60"
            style={{ minHeight: 42 }}
          />
          <button className="boton chico" onClick={agregar}>
            +
          </button>
          <button className="boton chico secundario" onClick={() => setAbierto(false)}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------
     Formatos de etiqueta: marcar cuál viene elegido por defecto.

     La base tiene un índice que permite UN solo predeterminado, así que hay que
     apagar el anterior antes de prender el nuevo. Si no, Postgres lo rechaza.
     ------------------------------------------------------------------------- */

  function BotonPredeterminado({ fila, recargar }) {
    const [trabajando, setTrabajando] = useState(false);

    async function marcar() {
      if (fila.predeterminado || trabajando) return;

      setTrabajando(true);
      await window.App.db
        .from("formatos_etiqueta")
        .update({ predeterminado: false })
        .eq("predeterminado", true);
      await window.App.db
        .from("formatos_etiqueta")
        .update({ predeterminado: true })
        .eq("id", fila.id);
      setTrabajando(false);

      recargar();
    }

    if (fila.predeterminado) {
      return <span className="etiqueta-estado si">Predeterminado</span>;
    }

    return (
      <button className="boton chico secundario" onClick={marcar} disabled={trabajando}>
        Usar por defecto
      </button>
    );
  }

  /* -------------------------------------------------------------------------
     La pantalla completa
     ------------------------------------------------------------------------- */

  function PantallaConfiguracion() {
    const Abm = window.App.Abm;

    return (
      <div>
        <div className="panel">
          <h1>⚙️ Configuración</h1>
          <p className="subtitulo">
            Los datos que se cargan una vez y después se eligen al armar cada pallet.
          </p>
        </div>

        <Marca />

        <window.App.ModoImpresion />

        <window.App.AyudaImpresora />

        <window.App.PruebaImpresora />

        <Abm
          titulo="Formatos de etiqueta"
          descripcion="Las medidas reales de cada etiqueta que tengan en planta, medidas con una regla."
          tabla="formatos_etiqueta"
          campos={[
            { nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
            { nombre: "ancho_mm", etiqueta: "Ancho (mm)", tipo: "numero", requerido: true },
            { nombre: "alto_mm", etiqueta: "Alto (mm)", tipo: "numero", requerido: true },
          ]}
          extras={{
            titulo: "Por defecto",
            render: (fila, recargar) => <BotonPredeterminado fila={fila} recargar={recargar} />,
          }}
        />

        <Abm
          titulo="Clientes"
          descripcion="Cada cliente puede tener sus medidas frecuentes, para cargarlas de un toque."
          tabla="clientes"
          campos={[{ nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true }]}
          extras={{
            titulo: "Medidas frecuentes",
            render: (fila) => <PlantillasCliente cliente={fila} />,
          }}
        />

        <Abm
          titulo="Materiales"
          descripcion="Los que usan en planta. Van como lista para que el mismo material no termine escrito de tres formas distintas y después se puedan sumar los kilos por material."
          tabla="materiales"
          campos={[{ nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true }]}
        />

        <Abm
          titulo="Colores"
          tabla="colores"
          campos={[{ nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true }]}
        />

        <Abm
          titulo="Aditivos"
          descripcion="Master de color, protección UV, aditivos y cargas. La dosis en gramos por kilo se carga después en cada máquina, porque cambia según lo que esté produciendo."
          tabla="aditivos"
          campos={[
            { nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
            {
              nombre: "tipo",
              etiqueta: "Tipo",
              tipo: "select",
              opciones: ["master", "uv", "aditivo", "carga"],
              porDefecto: "aditivo",
              requerido: true,
            },
          ]}
        />

        <Abm
          titulo="Operarios"
          descripcion="Las iniciales son las que salen impresas en la etiqueta."
          tabla="operarios"
          campos={[
            { nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
            {
              nombre: "iniciales",
              etiqueta: "Iniciales",
              tipo: "texto",
              requerido: true,
              largoMaximo: 4,
            },
          ]}
        />

        <Abm
          titulo="Máquinas"
          descripcion="El número es obligatorio: es como las nombran en planta, va impreso en la etiqueta y forma parte del número de bobina (la bobina 123 de la máquina 6 es 06-00123)."
          tabla="maquinas"
          orden="numero"
          campos={[
            {
              nombre: "numero",
              etiqueta: "Número",
              tipo: "numero",
              paso: "1",
              requerido: true,
            },
            { nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
          ]}
        />
      </div>
    );
  }

  window.App.PantallaConfiguracion = PantallaConfiguracion;
})();

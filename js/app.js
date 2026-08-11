/**
 * Armazón del sistema: verifica la sesión, dibuja la navegación y muestra
 * la pantalla elegida.
 */

(function () {
  const { useState, useEffect } = React;

  const PANTALLAS = [
    { id: "inicio", icono: "🏠", texto: "Inicio" },
    { id: "nuevo", icono: "📦", texto: "Nuevo pallet" },
    { id: "historial", icono: "📋", texto: "Historial" },
    { id: "reimpresion", icono: "🖨️", texto: "Reimpresión" },
    { id: "configuracion", icono: "⚙️", texto: "Configuración" },
  ];

  function Sistema() {
    const [sesion, setSesion] = useState(null);
    const [nombre, setNombre] = useState("");
    const [activa, setActiva] = useState("configuracion");

    useEffect(() => {
      window.App.auth.exigirSesion().then(async (s) => {
        if (!s) return; // exigirSesion ya redirigió al login
        setSesion(s);
        setNombre(await window.App.auth.nombreUsuario(s.user.id));
      });
    }, []);

    if (!sesion) {
      return <div className="cargando">Verificando sesión…</div>;
    }

    const Pendiente = window.App.Pendiente;

    function contenido() {
      switch (activa) {
        case "configuracion":
          return <window.App.PantallaConfiguracion />;
        case "inicio":
          return (
            <Pendiente
              titulo="🏠 Inicio"
              etapa={7}
              descripcion="Pallets del día, kilos totales, operario y máquina con más producción."
            />
          );
        case "nuevo":
          return (
            <Pendiente
              titulo="📦 Nuevo pallet"
              etapa={4}
              descripcion="Carga de cliente, operario, máquina, turno y productos, con peso total automático."
            />
          );
        case "historial":
          return (
            <Pendiente
              titulo="📋 Historial"
              etapa={6}
              descripcion="Buscador por número, detalle, edición de observaciones y reimpresión."
            />
          );
        case "reimpresion":
          return (
            <Pendiente
              titulo="🖨️ Reimpresión"
              etapa={6}
              descripcion="Buscar un pallet y volver a mandar a la Zebra la misma etiqueta."
            />
          );
        default:
          return null;
      }
    }

    return (
      <>
        <header className="encabezado">
          <div className="encabezado-inner">
            <div className="marca">
              PALLETS
              <small>Registro de producción</small>
            </div>
            <div className="usuario">
              <span>{nombre || sesion.user.email}</span>
              <button className="boton chico secundario" onClick={() => window.App.auth.salir()}>
                Salir
              </button>
            </div>
          </div>
        </header>

        <nav className="nav">
          <div className="nav-inner">
            {PANTALLAS.map((p) => (
              <button
                key={p.id}
                className={activa === p.id ? "activa" : ""}
                onClick={() => setActiva(p.id)}
              >
                {p.icono} {p.texto}
              </button>
            ))}
          </div>
        </nav>

        <main className="contenido">{contenido()}</main>
      </>
    );
  }

  ReactDOM.createRoot(document.getElementById("raiz")).render(<Sistema />);
})();

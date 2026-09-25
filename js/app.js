/**
 * Armazón del sistema: verifica la sesión, dibuja la navegación y muestra
 * la pantalla elegida.
 */

(function () {
  const { useState, useEffect } = React;

  /*
    "Nuevo pallet" no está en la lista a propósito: el pallet dejó de ser una
    lista de productos sueltos y pasa a ser un conjunto de bobinas. Vuelve en
    la Etapa 9, ya con el flujo correcto. No quiero dejar una pantalla que
    hace algo que ya no se usa.
  */
  const PANTALLAS = [
    { id: "inicio", icono: "🏠", texto: "Inicio" },
    { id: "bobina", icono: "🧵", texto: "Nueva bobina" },
    { id: "maquinas", icono: "🛠️", texto: "Máquinas" },
    { id: "historial", icono: "📋", texto: "Historial" },
    { id: "reimpresion", icono: "🖨️", texto: "Reimpresión" },
    { id: "configuracion", icono: "⚙️", texto: "Configuración" },
  ];

  function Sistema() {
    const [sesion, setSesion] = useState(null);
    const [nombre, setNombre] = useState("");
    // Arranca en "Nueva bobina": es lo que se usa todo el día.
    const [activa, setActiva] = useState("bobina");

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
          // irA deja que Inicio mande al encargado a otra pantalla de un toque.
          return <window.App.PantallaInicio irA={setActiva} />;
        case "bobina":
          return <window.App.PantallaNuevaBobina />;
        case "maquinas":
          return <window.App.PantallaMaquinas />;
        case "historial":
          return <window.App.PantallaHistorialBobinas />;
        case "reimpresion":
          return <window.App.PantallaReimpresionBobinas />;
        default:
          return null;
      }
    }

    return (
      <>
        <header className="encabezado">
          <div className="encabezado-inner">
            <div className="marca">
              PRODUCCIÓN
              <small>Bobinas y etiquetas</small>
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

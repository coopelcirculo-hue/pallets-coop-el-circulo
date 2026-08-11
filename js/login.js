/**
 * Pantalla de login.
 * Si ya hay sesión guardada, ni la muestra: manda derecho al sistema.
 */

(function () {
  const { useState, useEffect } = React;

  function Login() {
    const [verificando, setVerificando] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [entrando, setEntrando] = useState(false);

    useEffect(() => {
      window.App.auth.sesion().then((sesion) => {
        if (sesion) {
          window.location.replace("app.html");
        } else {
          setVerificando(false);
        }
      });
    }, []);

    async function enviar(e) {
      e.preventDefault();
      if (entrando) return; // anti doble toque

      setEntrando(true);
      setError("");

      const resultado = await window.App.auth.entrar(email, password);

      if (resultado.ok) {
        window.location.replace("app.html");
      } else {
        setError(resultado.error);
        setEntrando(false);
      }
    }

    if (verificando) {
      return <div className="cargando">Cargando…</div>;
    }

    return (
      <div className="login-pantalla">
        <form className="login-caja" onSubmit={enviar}>
          <div className="login-titulo">
            <strong>PALLETS</strong>
            <span>Registro de producción</span>
          </div>

          {error && <div className="aviso error">{error}</div>}

          <div className="campo">
            <label htmlFor="email">Usuario</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button className="boton ancho" type="submit" disabled={entrando}>
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById("raiz")).render(<Login />);
})();

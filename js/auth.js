/**
 * Sesión: login, logout y el "portero" que patea a index.html si no hay sesión.
 */

window.App = window.App || {};

window.App.auth = {
  /** Devuelve la sesión activa, o null. */
  async sesion() {
    const { data } = await window.App.db.auth.getSession();
    return data.session || null;
  },

  /**
   * Entra al sistema. Devuelve { ok: true } o { ok: false, error: "..." }.
   * Los mensajes de Supabase vienen en inglés, así que traducimos los comunes.
   */
  async entrar(email, password) {
    const { error } = await window.App.db.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (!error) return { ok: true };

    const traducciones = {
      "Invalid login credentials": "Mail o contraseña incorrectos.",
      "Email not confirmed": "El usuario todavía no confirmó el mail.",
    };

    return { ok: false, error: traducciones[error.message] || error.message };
  },

  async salir() {
    await window.App.db.auth.signOut();
    window.location.href = "index.html";
  },

  /**
   * Portero de las pantallas internas: si no hay sesión, manda al login.
   * Devuelve la sesión para poder mostrar quién está trabajando.
   */
  async exigirSesion() {
    const sesion = await this.sesion();
    if (!sesion) {
      window.location.replace("index.html");
      return null;
    }
    return sesion;
  },

  /** Nombre del usuario logueado, de la tabla usuarios. */
  async nombreUsuario(userId) {
    const { data } = await window.App.db
      .from("usuarios")
      .select("nombre")
      .eq("id", userId)
      .maybeSingle();
    return data ? data.nombre : "";
  },
};

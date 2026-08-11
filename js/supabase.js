/**
 * Cliente de Supabase, uno solo para toda la app.
 *
 * La librería UMD deja el objeto en window.supabase, así que lo guardamos
 * con otro nombre para no pisarlo.
 */

window.App = window.App || {};

(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.App.CONFIG;

  window.App.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // La tablet queda logueada aunque se cierre el navegador: en planta
      // nadie quiere escribir la contraseña cada vez que agarra el equipo.
      persistSession: true,
      autoRefreshToken: true,
    },
  });
})();

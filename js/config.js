/**
 * Configuración del proyecto Supabase.
 *
 * OJO: esta clave es la "anon" y es PÚBLICA por diseño — viaja dentro de la
 * página, cualquiera que abra el código fuente la puede ver. Eso no es un
 * problema siempre y cuando:
 *
 *   1. Row Level Security esté activada en todas las tablas (scripts 003 y 005)
 *   2. El registro público de usuarios esté DESACTIVADO en Supabase
 *
 * Sin esas dos cosas, cualquiera con la URL entra al sistema.
 * La clave service_role NUNCA va acá.
 */

window.App = window.App || {};

window.App.CONFIG = {
  SUPABASE_URL: "https://afrkjuhvloghmhecyjos.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmcmtqdWh2bG9naG1oZWN5am9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Nzc4ODIsImV4cCI6MjEwMjA1Mzg4Mn0.VEnI_A4skd-g3lcfZrzG_NpyqR5e0GXIIqCE7es976M",
};

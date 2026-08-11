/**
 * Piezas de interfaz que se repiten en varias pantallas.
 *
 * OJO con el envoltorio (function () { ... })():
 * Babel ejecuta cada archivo en el ámbito global, así que sin esto dos
 * archivos que declaren `const { useState } = React` se pisarían entre sí y
 * la página no arrancaría. Todo lo que tiene que salir afuera se cuelga
 * de window.App.
 */

window.App = window.App || {};

(function () {
  window.App.ui = {
    /**
     * Traduce los errores de Postgres a algo que se entienda en planta.
     * Los códigos salen de la documentación de Postgres.
     */
    mensajeDeError(error) {
      if (!error) return "";

      const codigo = error.code || "";

      if (codigo === "23505") return "Ya existe uno con ese nombre.";
      if (codigo === "23503") return "No se puede: hay pallets que lo están usando.";
      if (codigo === "23514") return "Alguno de los valores cargados no es válido.";
      if (codigo === "42501" || codigo === "PGRST301") {
        return "No tenés permiso. Probá volver a entrar.";
      }

      return error.message || "Ocurrió un error inesperado.";
    },
  };

  /** Cartelito de éxito o error, con el mismo formato en todas las pantallas. */
  function Aviso({ tipo, children }) {
    if (!children) return null;
    return <div className={`aviso ${tipo}`}>{children}</div>;
  }

  /** Pantalla en construcción, para las etapas que faltan. */
  function Pendiente({ titulo, etapa, descripcion }) {
    return (
      <div className="pendiente">
        <h1>{titulo}</h1>
        <p className="subtitulo">{descripcion}</p>
        <span className="chip">Se construye en la Etapa {etapa}</span>
      </div>
    );
  }

  window.App.Aviso = Aviso;
  window.App.Pendiente = Pendiente;
})();

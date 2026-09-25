/**
 * Historial: buscar un pallet, ver todo, editar observaciones y reimprimir.
 */

window.App = window.App || {};

(function () {
  const { useState } = React;

  function Historial() {
    const [elegido, setElegido] = useState(null);

    if (elegido) {
      return (
        <window.App.DetallePallet
          palletId={elegido.id}
          onVolver={() => setElegido(null)}
          permitirEditar={true}
        />
      );
    }

    return (
      <div className="panel">
        <h1>📋 Historial</h1>
        <p className="subtitulo">
          Todos los pallets, del más nuevo al más viejo. Escribí parte del número para filtrar.
        </p>
        <window.App.BuscadorPallets
          onElegir={setElegido}
          ayuda="Con escribir 458 alcanza: no hace falta poner P-000458."
        />
      </div>
    );
  }

  window.App.PantallaHistorial = Historial;
})();

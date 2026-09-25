/**
 * Reimpresión: buscar un pallet y volver a mandar su etiqueta.
 *
 * Es la misma pantalla que Historial pero sin la edición de observaciones:
 * acá el encargado viene a una sola cosa, que es sacar otra etiqueta.
 */

window.App = window.App || {};

(function () {
  const { useState } = React;

  function Reimpresion() {
    const [elegido, setElegido] = useState(null);

    if (elegido) {
      return (
        <window.App.DetallePallet
          palletId={elegido.id}
          onVolver={() => setElegido(null)}
          permitirEditar={false}
        />
      );
    }

    return (
      <div className="panel">
        <h1>🖨️ Reimpresión</h1>
        <p className="subtitulo">
          Buscá el pallet y reenviá su etiqueta. Sale idéntica a la original.
        </p>
        <window.App.BuscadorPallets
          onElegir={setElegido}
          ayuda="Si se rompió o se despegó la etiqueta, buscá el pallet acá y reimprimila."
        />
      </div>
    );
  }

  window.App.PantallaReimpresion = Reimpresion;
})();

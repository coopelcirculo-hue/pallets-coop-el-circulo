/**
 * Vista previa de la etiqueta.
 *
 * Se dibuja a partir del MISMO diseño que genera el ZPL, así que las
 * posiciones son las reales. No es un render exacto de lo que escupe la
 * Zebra —la tipografía de la impresora es otra y el trazo térmico engorda un
 * poco— pero sirve para lo que importa: ver si el contenido entra, si algo se
 * pisa y si las medidas de la etiqueta están bien cargadas.
 */

window.App = window.App || {};

(function () {
  function VistaPrevia({ disenio, escala }) {
    if (!disenio) return null;

    // El SVG trabaja en milímetros: el viewBox es la etiqueta real.
    const px = escala || 3; // píxeles de pantalla por milímetro

    return (
      <div>
        <svg
          viewBox={`0 0 ${disenio.ancho} ${disenio.alto}`}
          width={disenio.ancho * px}
          height={disenio.alto * px}
          style={{
            background: "#fff",
            border: "1px solid var(--borde)",
            borderRadius: 6,
            maxWidth: "100%",
            height: "auto",
          }}
        >
          {/* Marca de hasta dónde llega el contenido */}
          {!disenio.entra && (
            <rect
              x="0"
              y={disenio.alto}
              width={disenio.ancho}
              height={Math.max(0, disenio.altoUsado - disenio.alto)}
              fill="#fee2e2"
            />
          )}

          {disenio.elementos.map((e, i) => {
            if (e.tipo === "linea") {
              return (
                <rect
                  key={i}
                  x={e.x}
                  y={e.y}
                  width={e.ancho}
                  height={Math.max(0.3, e.grosor)}
                  fill="#000"
                />
              );
            }

            const alaDerecha = e.alineacion === "der";
            return (
              <text
                key={i}
                x={alaDerecha ? e.x + e.ancho : e.x}
                y={e.y}
                fontSize={e.altura}
                fontFamily="Arial, Helvetica, sans-serif"
                fontWeight={e.negrita ? 700 : 400}
                textAnchor={alaDerecha ? "end" : "start"}
                dominantBaseline="text-before-edge"
                fill="#000"
              >
                {e.texto}
              </text>
            );
          })}
        </svg>

        <p style={{ fontSize: 13, color: "var(--tinta-tenue)", marginTop: 6 }}>
          {disenio.ancho} × {disenio.alto} mm · {disenio.dpi} dpi · contenido{" "}
          {disenio.altoUsado.toFixed(0)} mm
        </p>

        {!disenio.entra && (
          <div className="aviso error">
            El contenido ocupa {disenio.altoUsado.toFixed(0)} mm y la etiqueta tiene{" "}
            {disenio.alto} mm: lo de abajo se va a cortar. Usá una etiqueta más larga o
            cargá menos medidas por pallet.
          </div>
        )}
      </div>
    );
  }

  window.App.VistaPrevia = VistaPrevia;
})();

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
          {disenio.nivelTexto && ` · versión ${disenio.nivelTexto}`}
          {disenio.escala && disenio.escala < 1 && ` (letra al ${Math.round(disenio.escala * 100)}%)`}
        </p>

        {/* No entra a lo alto */}
        {disenio.entraAlto === false && (
          <div className="aviso error">
            El contenido ocupa {disenio.altoUsado.toFixed(0)} mm y la etiqueta tiene{" "}
            {disenio.alto} mm: lo de abajo se va a cortar. Hace falta una etiqueta más larga.
          </div>
        )}

        {/* No entra a lo ancho: es el caso que pasa desapercibido, porque en
            el papel se ve "lleno" pero el final de cada renglón falta. */}
        {disenio.desbordan && disenio.desbordan.length > 0 && (
          <div className="aviso error">
            La etiqueta es muy angosta: estos textos se van a imprimir cortados por el costado
            — {disenio.desbordan.slice(0, 3).join(" · ")}
            {disenio.desbordan.length > 3 && ` y ${disenio.desbordan.length - 3} más`}. Hace
            falta una etiqueta más ancha que {disenio.ancho} mm.
          </div>
        )}

        {/* Entra, pero apretado */}
        {disenio.entra && disenio.letraChica && (
          <div className="aviso atencion">
            Entra, pero la letra más chica queda en {disenio.letraMinima.toFixed(1)} mm. Se
            imprime, aunque va a costar leerla de lejos. Con una etiqueta un poco más grande
            se vería bastante mejor.
          </div>
        )}

        {/* Cuando hubo que sacar datos para que entrara */}
        {disenio.entra && disenio.nivel > 0 && (
          <div className="aviso" style={{ background: "var(--fondo)" }}>
            Para que entrara se dejó afuera{" "}
            {disenio.nivel === 1
              ? "la marca de arriba y el pie."
              : "la marca, el pie, la fecha y los rótulos."}{" "}
            Los datos de la bobina están todos.
          </div>
        )}

        {/* El pallet usa el mismo componente y no tiene niveles. */}
        {disenio.nivelTexto === undefined && !disenio.entra && (
          <div className="aviso error">
            El contenido ocupa {disenio.altoUsado.toFixed(0)} mm y la etiqueta tiene{" "}
            {disenio.alto} mm: lo de abajo se va a cortar.
          </div>
        )}
      </div>
    );
  }

  window.App.VistaPrevia = VistaPrevia;
})();

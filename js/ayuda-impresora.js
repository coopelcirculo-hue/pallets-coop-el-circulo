/**
 * Guía de conexión de la impresora, adentro de la app.
 *
 * Está acá y no en un papel porque es lo que se necesita justo cuando algo no
 * imprime, con la tablet en la mano y el encargado esperando.
 */

window.App = window.App || {};

(function () {
  const { useState } = React;

  function Paso({ numero, titulo, children }) {
    return (
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            flex: "0 0 30px",
            height: 30,
            borderRadius: "50%",
            background: "var(--primario)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {numero}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{titulo}</p>
          <div style={{ color: "var(--tinta-suave)", fontSize: 15 }}>{children}</div>
        </div>
      </div>
    );
  }

  function AyudaImpresora() {
    const [abierta, setAbierta] = useState(false);
    const [via, setVia] = useState("bluetooth");

    if (!abierta) {
      return (
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Cómo conectar la impresora</h2>
              <p className="subtitulo" style={{ margin: 0 }}>
                Los pasos para Bluetooth y para red, y qué hacer si no la encuentra.
              </p>
            </div>
            <button className="boton secundario" onClick={() => setAbierta(true)}>
              Ver los pasos
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Cómo conectar la impresora</h2>
          <button className="boton chico secundario" onClick={() => setAbierta(false)}>
            Cerrar
          </button>
        </div>

        <div className="aviso atencion">
          <strong>La IP de la impresora no se carga en esta app.</strong> El navegador no puede
          hablarle directo a una impresora, así que el puente es <strong>Zebra Browser
          Print</strong>, que se instala en la tablet. La impresora se configura una sola vez
          adentro de esa app, y desde ahí este sistema la usa solo.
        </div>

        <pre
          style={{
            background: "var(--fondo)",
            padding: 12,
            borderRadius: 10,
            fontSize: 13,
            overflowX: "auto",
            margin: "0 0 18px",
          }}
        >{`Esta app (Chrome)
   │  le habla a Browser Print, que está en la MISMA tablet
   ▼
Zebra Browser Print
   │  manda la etiqueta por Bluetooth o por red
   ▼
Zebra ZD421`}</pre>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button
            className={via === "bluetooth" ? "boton" : "boton secundario"}
            onClick={() => setVia("bluetooth")}
          >
            Por Bluetooth
          </button>
          <button
            className={via === "red" ? "boton" : "boton secundario"}
            onClick={() => setVia("red")}
          >
            Por red (cable)
          </button>
        </div>

        {via === "bluetooth" && (
          <div>
            <Paso numero="1" titulo="Instalá Zebra Browser Print en la tablet">
              Está en Play Store. Abrila una vez: después queda corriendo sola y arranca con la
              tablet.
            </Paso>

            <Paso numero="2" titulo="Poné la impresora en modo de emparejamiento">
              Con la impresora prendida, <strong>mantené apretado FEED 5 segundos</strong>. Eso
              la deja visible y emparejable durante <strong>2 minutos</strong>. Este es el paso
              que más se saltea, y sin él la búsqueda no la encuentra aunque esté al lado.
            </Paso>

            <Paso numero="3" titulo="Buscala desde Browser Print">
              Menú de las tres rayas, arriba a la izquierda → <strong>Discover Printers</strong>.
              Fijate que <strong>Bluetooth Discovery</strong> esté activado en los ajustes de la
              app. Hacelo dentro de los 2 minutos del paso anterior.
            </Paso>

            <Paso numero="4" titulo="Marcala como predeterminada">
              Tocá la impresora en la lista y ponela como <strong>Default</strong>. Si no queda
              marcada, este sistema no sabe a cuál mandarle y no imprime.
            </Paso>

            <Paso numero="5" titulo="Probá acá abajo">
              Volvé a esta pantalla y tocá <strong>Probar e imprimir una etiqueta</strong>. Te
              va a decir con tildes y cruces en qué paso está fallando.
            </Paso>
          </div>
        )}

        {via === "red" && (
          <div>
            <Paso numero="1" titulo="Conectá el cable de red">
              De la impresora al switch de la fábrica. Para una impresora fija, el cable es más
              confiable que el WiFi: no hay interferencia de las máquinas ni cortes de señal.
            </Paso>

            <Paso numero="2" titulo="Averiguá la IP">
              Con la luz en verde, <strong>mantené apretado FEED 2 segundos</strong>. Imprime el
              reporte de configuración con la <strong>IP</strong> y la <strong>MAC</strong>. Si
              dice <code>0.0.0.0</code> o no muestra IP, no está tomando dirección: revisá el
              cable o el DHCP del router.
            </Paso>

            <Paso numero="3" titulo="Fijá esa IP">
              Reserva DHCP en el router atada a la MAC, o IP estática en la impresora. Si la IP
              cambia sola un lunes, deja de imprimir y parece que se rompió el sistema.
            </Paso>

            <Paso numero="4" titulo="Comprobá que la tablet la alcanza">
              Con la tablet en el WiFi de esa red, abrí en Chrome <code>http://LA-IP</code>. Si
              carga la página de la Zebra, se ven. <strong>Si no carga, pará acá</strong>: es un
              problema de red (WiFi de invitados con aislamiento, o VLAN distinta) y ninguna
              configuración de la app lo arregla.
            </Paso>

            <Paso numero="5" titulo="Agregala en Browser Print, por IP">
              Importante: no uses <em>Broadcast Search</em>. La mayoría de los access points
              bloquean el broadcast entre el WiFi y la red cableada, así que la búsqueda
              automática falla aunque la impresora esté perfectamente alcanzable.{" "}
              <strong>Cargá la IP a mano</strong> desde <em>Manage Devices</em> y marcala como
              Default.
            </Paso>
          </div>
        )}

        <div className="aviso" style={{ background: "var(--fondo)", marginTop: 8 }}>
          <strong>Si nada de esto funciona, igual podés imprimir.</strong> Cada bobina tiene un
          botón <strong>Descargar .zpl</strong>: baja el archivo y Android lo abre con{" "}
          <strong>Zebra Print Connect</strong>, que lo manda a la impresora. Es un toque más,
          pero no depende de Browser Print ni de permisos del navegador. Y el registro de la
          bobina ya quedó guardado igual: nunca se pierde por un problema de impresión.
        </div>
      </div>
    );
  }

  window.App.AyudaImpresora = AyudaImpresora;
})();

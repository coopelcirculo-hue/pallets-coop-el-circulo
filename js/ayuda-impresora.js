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

        <div className="aviso error">
          <strong>Emparejar la impresora en el Bluetooth de Android no alcanza.</strong> Esta
          app no mira el Bluetooth del sistema: le pregunta a Browser Print. La impresora
          tiene que estar agregada <em>adentro de Browser Print</em> y marcada como
          predeterminada, aunque ya aparezca emparejada en los ajustes de la tablet.
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

            {/*
              La lista de impresoras soportadas del manual de Browser Print
              Android es de enero de 2020 y llega hasta la ZD420: la ZD421 es
              posterior y NO figura. La búsqueda automática puede no mostrarla
              nunca por más que el Bluetooth esté bien. Por eso este paso.
            */}
            <Paso numero="4" titulo="Si no aparece en la lista, agregala a mano">
              <strong>Esto es lo más probable con la ZD421.</strong> La búsqueda automática de
              Browser Print para Android se hizo cuando la ZD421 todavía no existía, así que
              puede no encontrarla aunque el Bluetooth esté perfecto. No es que esté mal
              conectada.
              <br />
              <br />
              Sacá el reporte de configuración (<strong>FEED 2 segundos</strong>) y anotá el{" "}
              <strong>BLUETOOTH ADDRESS</strong>: son 12 caracteres. Después, en Browser Print:
              menú de las tres rayas → <strong>Manage Devices</strong> → el botón{" "}
              <strong>+</strong> azul abajo a la derecha → elegí <strong>Bluetooth</strong> y
              cargá esa dirección con un nombre cualquiera → <strong>Add</strong>. Queda en la
              lista como si la hubiera descubierto sola.
            </Paso>

            <Paso numero="5" titulo="Marcala como predeterminada">
              Tocá la impresora en la lista y ponela como <strong>Default</strong>. Si no queda
              marcada, este sistema no sabe a cuál mandarle y no imprime.
            </Paso>

            <Paso numero="6" titulo="Aceptá el certificado (una sola vez)">
              Este es el paso invisible que hace que todo parezca roto. Esta página es segura
              (https) y Browser Print usa un certificado propio que Chrome no conoce, así que
              le corta la comunicación <em>sin avisar nada</em>. Abrí{" "}
              <a href="https://127.0.0.1:9101" target="_blank" rel="noopener noreferrer">
                https://127.0.0.1:9101
              </a>{" "}
              en la misma tablet, tocá <strong>Configuración avanzada</strong> →{" "}
              <strong>Acceder a 127.0.0.1 (no seguro)</strong>, y si pregunta si lo agregás
              como host aceptado, decile que sí.
            </Paso>

            {/*
              Chrome 141+ cortó el acceso de los sitios de internet a la propia
              máquina. Es nuevo y no está en ningún manual de Zebra, pero rompe
              exactamente esta cadena.
            */}
            <Paso numero="7" titulo="Permitile a Chrome hablar con la tablet">
              Chrome 141 y posteriores le piden permiso a cada sitio para hablarle a la propia
              tablet. La primera vez sale un cartel: tocá <strong>Permitir</strong>. Si ya le
              diste Bloquear, o si el cartel nunca salió, tocá el <strong>candado</strong> a la
              izquierda de la dirección → <strong>Permisos</strong> →{" "}
              <strong>Red local</strong> y ponelo en <strong>Permitir</strong>. El diagnóstico
              de acá abajo te avisa si es esto.
            </Paso>

            <Paso numero="8" titulo="Probá acá abajo">
              Volvé a esta pantalla y tocá <strong>Probar e imprimir una etiqueta</strong>. Te
              va a decir con tildes y cruces en qué paso está fallando, y qué pasó con cada
              puerto.
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

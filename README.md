# Producción · Coop El Círculo

Sistema web para registrar la producción de las extrusoras e imprimir la
etiqueta identificatoria en una **Zebra ZD421**.

## El modelo: bobinas y pallets

La unidad de producción es la **bobina**: lo que sale de cada extrusora, con
**una** medida (ancho y micrones), **un** peso, **una** máquina y **un**
operario. Es la que se etiqueta en planta.

El **pallet** es otra cosa: un conjunto de bobinas que se arma después. Su
flujo está en la Etapa 9; hasta entonces las bobinas quedan sueltas
(`bobinas.pallet_id` en null).

Cada máquina recuerda **qué está produciendo ahora** —su *corrida activa*— y
esa medida se guarda en la base, no en la pantalla. Con más de diez extrusoras
produciendo cosas distintas al mismo tiempo, al cargar una bobina alcanza con
elegir la máquina y poner los kilos. Además sobrevive a recargar la página,
cambiar de tablet y cambiar de turno.

## La jornada de producción

Los turnos son de 12 horas y el de noche cruza la medianoche. Por eso cada
bobina guarda **dos fechas**: la real y la **jornada de producción**, que es el
día en que arrancó su turno. Una bobina hecha a las 02:00 pertenece a la
jornada del día anterior. Sin esa distinción, la producción del turno noche
quedaría partida entre dos fechas y los resúmenes nunca cerrarían.

Los horarios de los turnos se configuran en `configuracion`
(`hora_inicio_turno_dia` y `hora_inicio_turno_noche`).

## Cómo funciona

Sitio **estático** (HTML + React UMD) servido por GitHub Pages, con Supabase
como base de datos. No hay servidor propio ni costo de hosting.

```
Tablet (navegador)  ──►  Supabase (datos + login)
        │
        └──►  Zebra Browser Print  ──►  Zebra ZD421
```

El navegador no puede abrir sockets TCP, así que el ZPL no viaja directo a la
impresora: lo pasa **Zebra Browser Print**, una app oficial de Zebra que se
instala en la tablet y hace de puente.

## Seguridad

La clave que viaja en `js/config.js` es la **anon key** y es pública por
diseño: cualquiera que abra el código fuente la ve. Lo que protege los datos
son dos cosas, y las dos tienen que estar:

1. **Row Level Security** activada en todas las tablas (scripts `003` y `005`).
   Sin sesión iniciada no se lee ni se escribe una sola fila.
2. **Registro público desactivado** en Supabase → *Authentication → Sign In /
   Providers → "Allow new users to sign up"* en **off**.

Si el registro queda abierto, cualquiera se crea una cuenta y entra al sistema.
Los usuarios se crean a mano en *Authentication → Users*, poniéndoles
`{ "nombre": "Juan Pérez" }` en User Metadata.

La clave `service_role` **nunca** va en este repositorio.

## Base de datos

Los scripts de `supabase/` se corren **en orden** en el SQL Editor:

| Script | Qué hace |
|---|---|
| `001_schema.sql` | Tablas, índices y el trigger que mantiene el peso total |
| `002_secuencia.sql` | Numerador `P-000458` |
| `003_rls.sql` | Row Level Security |
| `004_seed.sql` | Datos de prueba |
| `005_formatos_etiqueta.sql` | Formatos de etiqueta (varias medidas) |
| `006_login.sql` | Tabla de usuarios y quién cargó cada pallet |
| `007_crear_pallet.sql` | Crea el pallet y sus productos en una sola transacción |
| `008_dpi_de_la_impresora.sql` | El dpi pasa de cada etiqueta a la impresora |
| `009_bobinas.sql` | Bobinas, corridas por máquina, turnos y jornada de producción |

**El dpi no va por etiqueta.** Son los puntos por pulgada del cabezal térmico:
una característica física de la impresora, que el ZD421 trae en 203 o en 300 y
no se cambia por software. Está en la etiqueta del modelo —`ZD4A042` es 203 dpi
y `ZD4A043` es 300— y también en el reporte de configuración. Lo que sí cambia
por etiqueta es el tamaño. Si el dpi está mal cargado, todo se imprime a otra
escala: un diseño de 100 mm sale de unos 68 mm.

Todos son idempotentes: se pueden volver a correr sin romper nada.

## Estructura

```
index.html      login
app.html        el sistema (las 5 pantallas)
css/estilo.css  estilos, pensados para tablet en planta
js/
  config.js                  URL y clave de Supabase
  supabase.js                cliente
  auth.js                    sesión, login, logout, portero
  ui.js                      piezas compartidas
  abm.js                     ABM genérico de las tablas maestras
  pantalla-configuracion.js  pantalla de Configuración
  app.js                     armazón y navegación
supabase/       scripts SQL
```

Cada archivo de `js/` va envuelto en `(function () { ... })()`. No es adorno:
Babel ejecuta todo en el ámbito global, y sin el envoltorio dos archivos que
declaren `const { useState } = React` se pisan y la página no arranca.

## Probar en local

Hace falta un servidor: abriendo los HTML con doble clic no funciona, porque
Babel no puede cargar los `.js` desde `file://`.

```bash
npx --yes serve .
```

## Estado por etapas

- [x] **1** — base del proyecto
- [x] **2** — base de datos, numerador y RLS
- [x] **3** — login y pantalla de Configuración
- [x] **4** — crear pallet
- [x] **5** — generación de ZPL e impresión
- [x] **6** — historial y reimpresión
- [x] **7** — inicio con estadísticas del día
- [x] **8** — bobinas: corridas por máquina, carga rápida y etiqueta
- [ ] **9** — pallets como conjuntos de bobinas

Queda pendiente (etapa 8, a futuro): mover la impresión y el reporte diario a
n8n, exportar a Excel/PDF y reportes por cliente, operario y máquina.

## Si la app deja de andar de golpe

Lo primero que hay que mirar es si el proyecto de Supabase está **pausado**: el
plan free los pausa tras una semana sin uso. Cuando eso pasa, el dominio deja de
resolver y parece que el proyecto se borró, pero no: se restaura desde el panel
con el botón **Restore**, conservando datos, URL y claves.

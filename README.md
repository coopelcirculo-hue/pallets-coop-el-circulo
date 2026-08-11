# Pallets · Tomás Dotti

Sistema web para registrar pallets de producción e imprimir la etiqueta
identificatoria en una **Zebra ZD421** conectada por WiFi.

## Arquitectura

El navegador **nunca** habla directo con la impresora:

```
Tablet (navegador)
    │  POST con los datos del pallet
    ▼
API Route de Next.js (en el VPS)
    │  1. valida
    │  2. genera número de pallet (sequence de Postgres)
    │  3. guarda en Supabase
    │  4. genera el ZPL
    │  5. abre socket TCP al puerto 9100 de la Zebra
    ▼
Zebra imprime
```

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend + API Routes
- **Supabase** (Postgres) con RLS preparada
- **Zebra ZD421** por socket TCP raw, puerto 9100 (ZPL)
- Deploy en VPS propio

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y completar los valores
npm run dev
```

Abrir http://localhost:3000 — la pantalla de Inicio muestra el estado de la
configuración. También está `GET /api/health` con el mismo dato en JSON.

## Variables de entorno

| Variable | Dónde se usa | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador + servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador | clave anónima, respeta RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | saltea RLS, nunca exponerla |
| `ZEBRA_IP` | solo servidor | IP fija de la impresora |
| `ZEBRA_PORT` | solo servidor | 9100 (estándar Zebra) |

## Estructura

```
src/
  app/
    page.tsx              🏠 Inicio (estadísticas → Etapa 7)
    nuevo-pallet/         📦 Carga de pallet (Etapa 4)
    historial/            📋 Búsqueda y detalle (Etapa 6)
    reimpresion/          🖨️ Reenvío del ZPL guardado (Etapa 6)
    configuracion/        ⚙️ ABM clientes/operarios/máquinas (Etapa 3)
    api/health/           chequeo de salud
  components/             componentes de UI
  lib/
    env.ts                lectura y validación de variables de entorno
    health.ts             chequeo de Supabase + impresora
    supabase/server.ts    cliente service_role (solo servidor)
    supabase/browser.ts   cliente anónimo (navegador, solo lecturas)
    zebra/config.ts       IP y puerto de la impresora
  types/db.ts             tipos del modelo de datos
```

## Estado por etapas

- [x] **Etapa 1** — base del proyecto, env, clientes Supabase, navegación
- [ ] **Etapa 2** — scripts SQL del modelo de datos + sequence + datos de prueba
- [ ] **Etapa 3** — pantalla de Configuración (ABM)
- [ ] **Etapa 4** — crear pallet (sin imprimir)
- [ ] **Etapa 5** — generación de ZPL + impresión por socket TCP
- [ ] **Etapa 6** — historial y reimpresión
- [ ] **Etapa 7** — inicio con estadísticas del día

import { obtenerEstadoSistema } from "@/lib/health";

// En la Etapa 7 esta pantalla pasa a mostrar las estadísticas del día.
// Por ahora sirve de chequeo visual de que todo está bien conectado.
export const dynamic = "force-dynamic";

const COLORES_SUPABASE = {
  ok: "bg-emerald-100 text-emerald-800",
  sin_tablas: "bg-amber-100 text-amber-800",
  sin_configurar: "bg-rose-100 text-rose-800",
  error: "bg-rose-100 text-rose-800",
} as const;

export default async function InicioPage() {
  const estado = await obtenerEstadoSistema();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">🏠 Inicio</h1>
        <p className="mt-1 text-slate-600">
          Las estadísticas del día se agregan en la Etapa 7. Mientras tanto, acá abajo está el
          estado de la instalación.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Estado del sistema</h2>

        <dl className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="font-medium">Supabase</dt>
            <dd
              className={`rounded-full px-3 py-1 text-sm ${COLORES_SUPABASE[estado.supabase.estado]}`}
            >
              {estado.supabase.detalle}
            </dd>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="font-medium">Impresora Zebra</dt>
            <dd
              className={`rounded-full px-3 py-1 text-sm ${
                estado.zebra.configurada
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {estado.zebra.destino ?? "Sin configurar (ZEBRA_IP)"}
            </dd>
          </div>
        </dl>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Variables de entorno
        </h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(estado.variables).map(([nombre, cargada]) => (
            <li key={nombre} className="flex items-center gap-2 text-sm">
              <span aria-hidden>{cargada ? "✅" : "❌"}</span>
              <code className="text-slate-700">{nombre}</code>
            </li>
          ))}
        </ul>

        {estado.faltantes.length > 0 && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Copiá <code>.env.example</code> a <code>.env.local</code> y completá las variables que
            faltan. Después reiniciá <code>npm run dev</code>.
          </p>
        )}
      </section>
    </div>
  );
}

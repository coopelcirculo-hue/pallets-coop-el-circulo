/**
 * Placeholder de las pantallas que todavía no se construyeron.
 * Se va reemplazando etapa por etapa.
 */
export default function PantallaPendiente({
  titulo,
  etapa,
  descripcion,
}: {
  titulo: string;
  etapa: number;
  descripcion: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="mt-2 text-slate-600">{descripcion}</p>
      <p className="mt-6 inline-block rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800">
        Se construye en la Etapa {etapa}
      </p>
    </section>
  );
}

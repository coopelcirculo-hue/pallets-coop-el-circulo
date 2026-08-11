import PantallaPendiente from "@/components/PantallaPendiente";

export default function ReimpresionPage() {
  return (
    <PantallaPendiente
      titulo="🖨️ Reimpresión"
      etapa={6}
      descripcion="Buscar un pallet y reenviar a la Zebra el ZPL ya guardado, sin regenerarlo."
    />
  );
}

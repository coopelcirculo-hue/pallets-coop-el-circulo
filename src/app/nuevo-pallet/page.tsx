import PantallaPendiente from "@/components/PantallaPendiente";

export default function NuevoPalletPage() {
  return (
    <PantallaPendiente
      titulo="📦 Nuevo pallet"
      etapa={4}
      descripcion="Carga de cliente, operario, máquina, turno y productos, con peso total automático."
    />
  );
}

export function validarAsignacion({ courier, estado }) {
  if (!courier) {
    throw new Error("El mensajero no existe");
  }

  if (courier.operational_status !== "AVAILABLE") {
    throw new Error("El mensajero no está disponible");
  }

  if (estado !== "PENDING") {
    throw new Error("Solo servicios pendientes pueden asignarse");
  }
}

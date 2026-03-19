import { ServicioStateMachine } from "../state-machine/servicio.machine";

export function validarEntrega({ estado, evidencia }) {

  if (estado !== "IN_TRANSIT") {
    throw new Error("Solo servicios en tránsito pueden entregarse");
  }

  // Solo valida si la spec lo exige
  if (ServicioStateMachine.requiresEvidence("DELIVERED") && !evidencia) {
    throw new Error("Se requiere evidencia para marcar como entregado");
  }

}

import { ServicioStateMachine, ServicioEstado } from "../state-machine/servicio.machine";

export function validarTransicion(
  estadoActual: ServicioEstado,
  nuevoEstado: ServicioEstado
) {
  if (!ServicioStateMachine.canTransition(estadoActual, nuevoEstado)) {
    throw new Error(
      `Transición inválida de ${estadoActual} a ${nuevoEstado}`
    );
  }
}

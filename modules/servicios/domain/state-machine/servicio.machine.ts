import { servicioSpec } from "@/specs/servicios.spec";

export type ServicioEstado = typeof servicioSpec.estados[number];

export class ServicioStateMachine {

  static canTransition(from: ServicioEstado, to: ServicioEstado): boolean {
    const allowed = servicioSpec.transiciones[from] || [];
    return allowed.includes(to);
  }

  static isFinalState(state: ServicioEstado): boolean {
    return servicioSpec.reglas.estadosFinales.includes(state);
  }

  static requiresCourier(state: ServicioEstado): boolean {
    return servicioSpec.reglas.requiereMensajero.includes(state);
  }

  static requiresEvidence(state: ServicioEstado): boolean {
    return servicioSpec.reglas.requiereEvidencia.includes(state);
  }

  static canBeCancelled(state: ServicioEstado): boolean {
    return servicioSpec.reglas.permiteCancelacion.includes(state);
  }

}

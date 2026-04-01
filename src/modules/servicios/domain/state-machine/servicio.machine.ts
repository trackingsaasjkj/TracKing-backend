import { servicioSpec } from './servicio-spec.data';

export type ServicioEstado = (typeof servicioSpec.estados)[number];

export class ServicioStateMachine {
  static canTransition(from: ServicioEstado, to: ServicioEstado): boolean {
    return (servicioSpec.transiciones[from] as readonly string[]).includes(to);
  }

  static isFinalState(state: ServicioEstado): boolean {
    return (servicioSpec.reglas.estadosFinales as readonly string[]).includes(state);
  }

  static requiresCourier(state: ServicioEstado): boolean {
    return (servicioSpec.reglas.requiereMensajero as readonly string[]).includes(state);
  }

  static requiresEvidence(state: ServicioEstado): boolean {
    return (servicioSpec.reglas.requiereEvidencia as readonly string[]).includes(state);
  }

  static canBeCancelled(state: ServicioEstado): boolean {
    return (servicioSpec.reglas.permiteCancelacion as readonly string[]).includes(state);
  }
}

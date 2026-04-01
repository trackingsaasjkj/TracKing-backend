import { mensajeroSpec } from './mensajero-spec.data';

export type MensajeroEstado = (typeof mensajeroSpec.estados)[number];

export class MensajeroStateMachine {
  static canTransition(from: MensajeroEstado, to: MensajeroEstado): boolean {
    return (mensajeroSpec.transiciones[from] as readonly string[]).includes(to);
  }

  static canReceiveServices(state: MensajeroEstado): boolean {
    return (mensajeroSpec.reglas.puedeRecibirServicios as readonly string[]).includes(state);
  }
}

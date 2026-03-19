import { AppException } from '../../../../core/errors/app.exception';
import { ServicioStateMachine, ServicioEstado } from '../state-machine/servicio.machine';

export function validarTransicion(actual: ServicioEstado, siguiente: ServicioEstado): void {
  if (!ServicioStateMachine.canTransition(actual, siguiente)) {
    throw new AppException(`Transición inválida: ${actual} → ${siguiente}`);
  }
}

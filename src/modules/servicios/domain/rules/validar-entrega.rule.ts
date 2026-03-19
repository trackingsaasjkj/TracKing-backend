import { AppException } from '../../../../core/errors/app.exception';
import { ServicioStateMachine, ServicioEstado } from '../state-machine/servicio.machine';

export function validarEntrega(params: {
  estado: ServicioEstado;
  evidencia: object | null;
}): void {
  if (params.estado !== 'IN_TRANSIT') {
    throw new AppException('Solo servicios IN_TRANSIT pueden marcarse como entregados');
  }
  if (ServicioStateMachine.requiresEvidence('DELIVERED') && !params.evidencia) {
    throw new AppException('Se requiere evidencia para marcar como DELIVERED');
  }
}

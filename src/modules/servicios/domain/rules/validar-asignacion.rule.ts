import { AppException } from '../../../../core/errors/app.exception';
import { ServicioEstado } from '../state-machine/servicio.machine';

const ASSIGNABLE_STATUSES = ['AVAILABLE', 'IN_SERVICE'];
const ASSIGNABLE_SERVICE_STATUSES = ['PENDING', 'ASSIGNED', 'ACCEPTED'];

export function validarAsignacion(params: {
  courier: { operational_status: string } | null;
  estado: ServicioEstado;
}): void {
  if (!params.courier) {
    throw new AppException('El mensajero no existe');
  }
  if (!ASSIGNABLE_STATUSES.includes(params.courier.operational_status)) {
    throw new AppException('El mensajero no está disponible (está No Disponible)');
  }
  if (!ASSIGNABLE_SERVICE_STATUSES.includes(params.estado)) {
    throw new AppException('Solo servicios PENDING, ASSIGNED o ACCEPTED pueden (re)asignarse');
  }
}

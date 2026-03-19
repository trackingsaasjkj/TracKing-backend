import { AppException } from '../../../../core/errors/app.exception';
import { ServicioEstado } from '../state-machine/servicio.machine';

export function validarAsignacion(params: {
  courier: { operational_status: string } | null;
  estado: ServicioEstado;
}): void {
  if (!params.courier) {
    throw new AppException('El mensajero no existe');
  }
  if (params.courier.operational_status !== 'AVAILABLE') {
    throw new AppException('El mensajero no está disponible');
  }
  if (params.estado !== 'PENDING') {
    throw new AppException('Solo servicios PENDING pueden asignarse');
  }
}

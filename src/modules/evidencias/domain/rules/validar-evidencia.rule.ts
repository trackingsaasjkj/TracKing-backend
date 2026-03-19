import { AppException } from '../../../../core/errors/app.exception';
import { ServicioEstado } from '../../../servicios/domain/state-machine/servicio.machine';

/**
 * Evidence can only be uploaded while the service is IN_TRANSIT.
 * DB enforces one evidence per service (service_id UNIQUE) — upload replaces existing.
 */
export function validarSubidaEvidencia(estado: ServicioEstado): void {
  if (estado !== 'IN_TRANSIT') {
    throw new AppException(
      `Solo se puede registrar evidencia cuando el servicio está IN_TRANSIT (estado actual: ${estado})`,
    );
  }
}

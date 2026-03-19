import { AppException } from '../../../../core/errors/app.exception';
import { mensajeroSpec } from '../../../../specs/mensajeros.spec';

type MensajeroEstado = (typeof mensajeroSpec.estados)[number];

/**
 * Spec source: mensajeroSpec.validaciones.tracking.puedeEnviarUbicacion = ['IN_SERVICE']
 * Only couriers actively on a service may broadcast their location.
 */
export function validarPuedeEnviarUbicacion(estado: MensajeroEstado): void {
  const allowed = mensajeroSpec.validaciones.tracking.puedeEnviarUbicacion as readonly string[];
  if (!allowed.includes(estado)) {
    throw new AppException(
      `Solo mensajeros IN_SERVICE pueden registrar ubicación (estado actual: ${estado})`,
    );
  }
}

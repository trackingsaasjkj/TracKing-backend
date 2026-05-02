import { AppException } from '../../../../core/errors/app.exception';
import { MensajeroStateMachine, MensajeroEstado } from '../mensajero.machine';

export function validarInicioJornada(estado: MensajeroEstado): void {
  // Allow starting from UNAVAILABLE (normal flow) or IN_SERVICE (has active
  // services from a previous session — the courier is already working).
  if (estado !== 'UNAVAILABLE' && estado !== 'IN_SERVICE') {
    throw new AppException(`No se puede iniciar jornada desde estado ${estado}`);
  }
}

export function validarFinJornada(
  estado: MensajeroEstado,
  serviciosActivos: number,
): void {
  if (!MensajeroStateMachine.canTransition(estado, 'UNAVAILABLE')) {
    throw new AppException(`No se puede finalizar jornada desde estado ${estado}`);
  }
  if (serviciosActivos > 0) {
    throw new AppException(
      `No se puede finalizar jornada con ${serviciosActivos} servicio(s) activo(s)`,
    );
  }
}

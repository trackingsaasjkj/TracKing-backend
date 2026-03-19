import { AppException } from '../../../../core/errors/app.exception';

/**
 * Spec: validaciones.reglas.debeExistirReglaActiva = true
 */
export function validarReglaActiva(regla: object | null): void {
  if (!regla) {
    throw new AppException('No existe una regla de liquidación activa para esta empresa');
  }
}

/**
 * Spec: condicionesGeneracion.rangoFechasObligatorio = true
 */
export function validarRangoFechas(startDate: Date, endDate: Date): void {
  if (startDate >= endDate) {
    throw new AppException('start_date debe ser anterior a end_date');
  }
}

/**
 * Spec: validaciones.liquidacion.totalServiciosDebeCoincidir = true
 *       validaciones.liquidacion.totalGanadoDebeSerPositivo  = true
 */
export function validarResultadoLiquidacion(
  totalServices: number,
  totalEarned: number,
): void {
  if (totalServices === 0) {
    throw new AppException(
      'No hay servicios DELIVERED en el rango de fechas indicado',
    );
  }
  if (totalEarned <= 0) {
    throw new AppException('El total calculado debe ser mayor a cero');
  }
}

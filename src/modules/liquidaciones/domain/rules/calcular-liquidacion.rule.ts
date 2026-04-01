import { liquidacionSpec } from '../liquidacion-spec.data';

export type TipoRegla = (typeof liquidacionSpec.reglas.tiposRegla)[number];

export interface ReglaLiquidacion {
  type: TipoRegla;
  value: number;
}

export interface ServicioParaLiquidar {
  delivery_price: number;
}

/**
 * Spec: calculo.porcentaje = "total_earned * (value / 100)"
 *       calculo.fijo       = "value"
 * Applied per service, then summed.
 */
export function calcularGananciaServicio(
  servicio: ServicioParaLiquidar,
  regla: ReglaLiquidacion,
): number {
  if (regla.type === 'PERCENTAGE') {
    return Number(servicio.delivery_price) * (Number(regla.value) / 100);
  }
  return Number(regla.value); // FIXED
}

export function calcularTotalLiquidacion(
  servicios: ServicioParaLiquidar[],
  regla: ReglaLiquidacion,
): number {
  return servicios.reduce((sum, s) => sum + calcularGananciaServicio(s, regla), 0);
}

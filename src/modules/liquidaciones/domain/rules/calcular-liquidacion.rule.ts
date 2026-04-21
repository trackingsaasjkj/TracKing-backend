import { DecimalUtil } from '../../../../core/utils/decimal.util';

export type TipoRegla = 'PERCENTAGE' | 'FIXED';

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
    return DecimalUtil.toNumber(
      DecimalUtil.percentage(servicio.delivery_price, regla.value),
    );
  }
  return DecimalUtil.toNumber(regla.value);
}

export function calcularTotalLiquidacion(
  servicios: ServicioParaLiquidar[],
  regla: ReglaLiquidacion,
): number {
  const total = servicios.reduce((acc, s) => {
    const ganancia = calcularGananciaServicio(s, regla);
    return DecimalUtil.add(acc, ganancia);
  }, DecimalUtil.fromNumber(0));

  return DecimalUtil.toNumber(total);
}

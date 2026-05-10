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
 * Calcula la ganancia de la empresa para un servicio individual.
 * PERCENTAGE: delivery_price * (value / 100)
 * FIXED:      value (monto fijo, independiente del precio del servicio)
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

/**
 * Calcula la comisión total de la empresa para una liquidación.
 * PERCENTAGE: Σ(delivery_price_i * value/100) — aplica % por servicio y suma
 * FIXED:      value (monto fijo al total de la liquidación, sin importar cantidad de servicios)
 */
export function calcularTotalLiquidacion(
  servicios: ServicioParaLiquidar[],
  regla: ReglaLiquidacion,
): number {
  if (regla.type === 'FIXED') {
    // Monto fijo al total, no multiplicado por cantidad de servicios
    return DecimalUtil.toNumber(regla.value);
  }

  // PERCENTAGE: aplicar % sobre cada delivery_price y sumar
  const total = servicios.reduce((acc, s) => {
    const ganancia = DecimalUtil.percentage(s.delivery_price, regla.value);
    return DecimalUtil.add(acc, ganancia);
  }, DecimalUtil.fromNumber(0));

  return DecimalUtil.toNumber(total);
}

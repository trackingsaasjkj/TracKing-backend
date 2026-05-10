import {
  calcularGananciaServicio,
  calcularTotalLiquidacion,
} from '../../../modules/liquidaciones/domain/rules/calcular-liquidacion.rule';

describe('calcularGananciaServicio', () => {
  it('PERCENTAGE: 15% of delivery_price 10000 = 1500', () => {
    expect(calcularGananciaServicio({ delivery_price: 10000 }, { type: 'PERCENTAGE', value: 15 })).toBe(1500);
  });

  it('PERCENTAGE: 10% of delivery_price 8000 = 800', () => {
    expect(calcularGananciaServicio({ delivery_price: 8000 }, { type: 'PERCENTAGE', value: 10 })).toBe(800);
  });

  it('FIXED: always returns the fixed value regardless of delivery_price', () => {
    expect(calcularGananciaServicio({ delivery_price: 50000 }, { type: 'FIXED', value: 3000 })).toBe(3000);
    expect(calcularGananciaServicio({ delivery_price: 1000 }, { type: 'FIXED', value: 3000 })).toBe(3000);
  });
});

describe('calcularTotalLiquidacion', () => {
  const servicios = [
    { delivery_price: 10000 },
    { delivery_price: 8000 },
    { delivery_price: 12000 },
  ];

  it('PERCENTAGE 15%: total = (10000+8000+12000) * 0.15 = 4500', () => {
    expect(calcularTotalLiquidacion(servicios, { type: 'PERCENTAGE', value: 15 })).toBe(4500);
  });

  it('FIXED 3000: total = 3000 (monto fijo al total, sin importar cantidad de servicios)', () => {
    expect(calcularTotalLiquidacion(servicios, { type: 'FIXED', value: 3000 })).toBe(3000);
  });

  it('FIXED: lista vacía también retorna el monto fijo', () => {
    expect(calcularTotalLiquidacion([], { type: 'FIXED', value: 3000 })).toBe(3000);
  });
});

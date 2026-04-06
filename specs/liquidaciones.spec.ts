/**
 * Tests de Liquidaciones — specs/liquidaciones.spec.ts
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
import * as fc from 'fast-check';

import {
  calcularGananciaServicio,
  calcularTotalLiquidacion,
} from '../src/modules/liquidaciones/domain/rules/calcular-liquidacion.rule';
import {
  validarReglaActiva,
  validarResultadoLiquidacion,
} from '../src/modules/liquidaciones/domain/rules/validar-liquidacion.rule';
import { GenerarLiquidacionCourierUseCase } from '../src/modules/liquidaciones/application/use-cases/generar-liquidacion-courier.use-case';
import { AppException } from '../src/core/errors/app.exception';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeLiquidacionRepo() {
  return {
    findActiveRule: jest.fn(),
    findDeliveredServices: jest.fn(),
    createCourierSettlement: jest.fn(),
  } as any;
}

function makeMensajeroRepo() {
  return {
    findById: jest.fn(),
  } as any;
}

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    courier_id: 'courier-1',
    start_date: '2024-01-01',
    end_date: '2024-01-31',
    ...overrides,
  };
}

// ─── 7.3 calcularGananciaServicio — PERCENTAGE ────────────────────────────────

describe('calcularGananciaServicio — PERCENTAGE', () => {
  // 7.3 Unit test: calcular con regla PERCENTAGE → delivery_price * (value / 100)
  it('calcula delivery_price * (value / 100)', () => {
    const result = calcularGananciaServicio(
      { delivery_price: 200 },
      { type: 'PERCENTAGE', value: 10 },
    );
    expect(result).toBeCloseTo(20);
  });

  it('calcula correctamente con 100% → igual al precio', () => {
    const result = calcularGananciaServicio(
      { delivery_price: 500 },
      { type: 'PERCENTAGE', value: 100 },
    );
    expect(result).toBeCloseTo(500);
  });
});

// ─── 7.4 calcularGananciaServicio — FIXED ─────────────────────────────────────

describe('calcularGananciaServicio — FIXED', () => {
  // 7.4 Unit test: calcular con regla FIXED → value independiente del precio
  it('retorna siempre el value fijo sin importar el precio', () => {
    const result = calcularGananciaServicio(
      { delivery_price: 9999 },
      { type: 'FIXED', value: 50 },
    );
    expect(result).toBe(50);
  });

  it('retorna value fijo incluso con precio 0', () => {
    const result = calcularGananciaServicio(
      { delivery_price: 0 },
      { type: 'FIXED', value: 25 },
    );
    expect(result).toBe(25);
  });
});

// ─── 7.5 validarResultadoLiquidacion — sin servicios DELIVERED ────────────────

describe('validarResultadoLiquidacion', () => {
  // 7.5 Unit test: generar liquidación sin servicios DELIVERED en rango → error
  it('lanza AppException cuando totalServices = 0', () => {
    expect(() => validarResultadoLiquidacion(0, 0)).toThrow(AppException);
  });

  it('lanza AppException cuando totalEarned <= 0 con servicios', () => {
    expect(() => validarResultadoLiquidacion(1, 0)).toThrow(AppException);
  });

  it('no lanza cuando hay servicios y total positivo', () => {
    expect(() => validarResultadoLiquidacion(3, 150)).not.toThrow();
  });
});

// ─── 7.6 validarReglaActiva — sin regla activa ────────────────────────────────

describe('validarReglaActiva', () => {
  // 7.6 Unit test: generar liquidación sin regla activa → error
  it('lanza AppException cuando regla es null', () => {
    expect(() => validarReglaActiva(null)).toThrow(AppException);
  });

  it('no lanza cuando existe una regla', () => {
    expect(() => validarReglaActiva({ type: 'FIXED', value: 10 })).not.toThrow();
  });
});

// ─── 7.7 servicios ya liquidados no se incluyen ───────────────────────────────

describe('GenerarLiquidacionCourierUseCase — servicios ya liquidados', () => {
  let useCase: GenerarLiquidacionCourierUseCase;
  let liquidacionRepo: ReturnType<typeof makeLiquidacionRepo>;
  let mensajeroRepo: ReturnType<typeof makeMensajeroRepo>;

  beforeEach(() => {
    liquidacionRepo = makeLiquidacionRepo();
    mensajeroRepo = makeMensajeroRepo();
    useCase = new GenerarLiquidacionCourierUseCase(liquidacionRepo, mensajeroRepo);
    liquidacionRepo.markCourierServicesAsSettled = jest.fn().mockResolvedValue(undefined);
  });

  // 7.7 Unit test: servicios ya liquidados no se incluyen (mock returns empty array)
  it('lanza AppException cuando findDeliveredServices retorna array vacío', async () => {
    mensajeroRepo.findById.mockResolvedValue({ id: 'courier-1' });
    liquidacionRepo.findActiveRule.mockResolvedValue({ type: 'PERCENTAGE', value: 10 });
    liquidacionRepo.findDeliveredServices.mockResolvedValue([]);

    await expect(
      useCase.execute(makeDto(), 'co-1'),
    ).rejects.toThrow(AppException);
  });

  it('crea liquidación cuando hay servicios entregados', async () => {
    mensajeroRepo.findById.mockResolvedValue({ id: 'courier-1' });
    liquidacionRepo.findActiveRule.mockResolvedValue({ type: 'FIXED', value: 30 });
    liquidacionRepo.findDeliveredServices.mockResolvedValue([
      { delivery_price: 100 },
      { delivery_price: 200 },
    ]);
    liquidacionRepo.createCourierSettlement.mockResolvedValue({
      id: 'settlement-1',
      total_services: 2,
      total_earned: 60,
    });

    const result = await useCase.execute(makeDto(), 'co-1');

    expect(liquidacionRepo.createCourierSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ total_services: 2, total_earned: 60 }),
    );
    expect(result.total_services).toBe(2);
  });

  it('lanza AppException cuando no existe regla activa', async () => {
    mensajeroRepo.findById.mockResolvedValue({ id: 'courier-1' });
    liquidacionRepo.findActiveRule.mockResolvedValue(null);

    await expect(
      useCase.execute(makeDto(), 'co-1'),
    ).rejects.toThrow(AppException);
  });
});

// ─── 7.8 PBT: PERCENTAGE — precio * (pct/100) ────────────────────────────────

describe('P-7.8: calcularGananciaServicio PERCENTAGE (PBT)', () => {
  /**
   * Validates: Requirements 4.1
   * Para cualquier precio y porcentaje válidos, el resultado debe ser precio * (pct/100).
   */
  it('P-7.8: resultado siempre = precio * (pct/100)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100000, noNaN: true }),
        fc.float({ min: 1, max: 100, noNaN: true }),
        (precio, pct) => {
          const result = calcularGananciaServicio(
            { delivery_price: precio },
            { type: 'PERCENTAGE', value: pct },
          );
          const expected = precio * (pct / 100);
          expect(result).toBeCloseTo(expected, 5);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── 7.9 PBT: FIXED — resultado siempre = value ──────────────────────────────

describe('P-7.9: calcularGananciaServicio FIXED (PBT)', () => {
  /**
   * Validates: Requirements 4.2
   * Para regla FIXED, el resultado siempre es el value sin importar el precio.
   */
  it('P-7.9: regla FIXED con cualquier precio → resultado siempre = value', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100000, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }),
        (precio, value) => {
          const result = calcularGananciaServicio(
            { delivery_price: precio },
            { type: 'FIXED', value },
          );
          expect(result).toBe(value);
        },
      ),
      { numRuns: 100 },
    );
  });
});

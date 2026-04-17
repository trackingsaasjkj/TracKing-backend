/**
 * Tests de Liquidaciones en Courier Mobile — specs/courier-mobile-settlements.spec.ts
 * Cubre los 3 nuevos endpoints de liquidaciones expuestos en CourierMobileController:
 *   GET /api/courier/settlements
 *   GET /api/courier/settlements/earnings
 *   GET /api/courier/settlements/:id
 */
import * as fc from 'fast-check';

import { ConsultarLiquidacionesUseCase } from '../src/modules/liquidaciones/application/use-cases/consultar-liquidaciones.use-case';
import { NotFoundException } from '@nestjs/common';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeSettlement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'settlement-1',
    courier_id: 'courier-1',
    company_id: 'co-1',
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-01-31'),
    total_services: 10,
    total_earned: 300,
    created_at: new Date('2025-02-01'),
    ...overrides,
  };
}

function makeLiquidacionRepo() {
  return {
    findCourierSettlements: jest.fn(),
    findCourierSettlementById: jest.fn(),
    findCustomerSettlements: jest.fn(),
  } as any;
}

// ─── findCourierSettlements ───────────────────────────────────────────────────

describe('ConsultarLiquidacionesUseCase.findCourierSettlements', () => {
  let useCase: ConsultarLiquidacionesUseCase;
  let repo: ReturnType<typeof makeLiquidacionRepo>;

  beforeEach(() => {
    repo = makeLiquidacionRepo();
    useCase = new ConsultarLiquidacionesUseCase(repo);
  });

  it('retorna lista de liquidaciones del mensajero', async () => {
    const settlements = [makeSettlement(), makeSettlement({ id: 'settlement-2' })];
    repo.findCourierSettlements.mockResolvedValue(settlements);

    const result = await useCase.findCourierSettlements('co-1', 'courier-1');

    expect(repo.findCourierSettlements).toHaveBeenCalledWith('co-1', 'courier-1');
    expect(result).toHaveLength(2);
  });

  it('retorna array vacío cuando el mensajero no tiene liquidaciones', async () => {
    repo.findCourierSettlements.mockResolvedValue([]);

    const result = await useCase.findCourierSettlements('co-1', 'courier-1');

    expect(result).toEqual([]);
  });

  it('filtra por company_id — no retorna liquidaciones de otra empresa', async () => {
    repo.findCourierSettlements.mockResolvedValue([]);

    await useCase.findCourierSettlements('otra-empresa', 'courier-1');

    expect(repo.findCourierSettlements).toHaveBeenCalledWith('otra-empresa', 'courier-1');
  });
});

// ─── findCourierSettlementById ────────────────────────────────────────────────

describe('ConsultarLiquidacionesUseCase.findCourierSettlementById', () => {
  let useCase: ConsultarLiquidacionesUseCase;
  let repo: ReturnType<typeof makeLiquidacionRepo>;

  beforeEach(() => {
    repo = makeLiquidacionRepo();
    useCase = new ConsultarLiquidacionesUseCase(repo);
  });

  it('retorna la liquidación cuando existe', async () => {
    const settlement = makeSettlement();
    repo.findCourierSettlementById.mockResolvedValue(settlement);

    const result = await useCase.findCourierSettlementById('settlement-1', 'co-1');

    expect(repo.findCourierSettlementById).toHaveBeenCalledWith('settlement-1', 'co-1');
    expect(result.id).toBe('settlement-1');
  });

  it('lanza NotFoundException cuando la liquidación no existe', async () => {
    repo.findCourierSettlementById.mockResolvedValue(null);

    await expect(
      useCase.findCourierSettlementById('no-existe', 'co-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── getEarnings ──────────────────────────────────────────────────────────────

describe('ConsultarLiquidacionesUseCase.getEarnings', () => {
  let useCase: ConsultarLiquidacionesUseCase;
  let repo: ReturnType<typeof makeLiquidacionRepo>;

  beforeEach(() => {
    repo = makeLiquidacionRepo();
    useCase = new ConsultarLiquidacionesUseCase(repo);
  });

  it('calcula correctamente el resumen de ganancias', async () => {
    const settlements = [
      makeSettlement({ total_earned: 300, total_services: 10 }),
      makeSettlement({ id: 'settlement-2', total_earned: 500, total_services: 15 }),
    ];
    repo.findCourierSettlements.mockResolvedValue(settlements);

    const result = await useCase.getEarnings('co-1', 'courier-1');

    expect(result.total_settlements).toBe(2);
    expect(result.total_services).toBe(25);
    expect(result.total_earned).toBeCloseTo(800);
    expect(result.settlements).toHaveLength(2);
  });

  it('retorna ceros cuando no hay liquidaciones', async () => {
    repo.findCourierSettlements.mockResolvedValue([]);

    const result = await useCase.getEarnings('co-1', 'courier-1');

    expect(result.total_settlements).toBe(0);
    expect(result.total_services).toBe(0);
    expect(result.total_earned).toBe(0);
    expect(result.settlements).toEqual([]);
  });

  it('pasa el courier_id al repositorio para filtrar solo sus liquidaciones', async () => {
    repo.findCourierSettlements.mockResolvedValue([]);

    await useCase.getEarnings('co-1', 'courier-abc');

    expect(repo.findCourierSettlements).toHaveBeenCalledWith('co-1', 'courier-abc');
  });
});

// ─── PBT: getEarnings — total_earned siempre es la suma de settlements ────────

describe('P-CM-1: getEarnings total_earned = suma de total_earned de cada settlement (PBT)', () => {
  /**
   * Para cualquier array de settlements, total_earned debe ser exactamente
   * la suma de todos los total_earned individuales.
   */
  it('P-CM-1: total_earned acumulado es siempre la suma correcta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            total_earned: fc.float({ min: 0, max: Math.fround(100000), noNaN: true }),
            total_services: fc.integer({ min: 0, max: 500 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        async (settlements) => {
          const repo = makeLiquidacionRepo();
          repo.findCourierSettlements.mockResolvedValue(settlements);
          const useCase = new ConsultarLiquidacionesUseCase(repo);

          const result = await useCase.getEarnings('co-1', 'courier-1');

          const expectedTotal = settlements.reduce((sum, s) => sum + Number(s.total_earned), 0);
          expect(result.total_earned).toBeCloseTo(expectedTotal, 4);
          expect(result.total_settlements).toBe(settlements.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── PBT: getEarnings — total_services siempre es la suma de settlements ──────

describe('P-CM-2: getEarnings total_services = suma de total_services de cada settlement (PBT)', () => {
  it('P-CM-2: total_services acumulado es siempre la suma correcta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            total_earned: fc.float({ min: 0, max: Math.fround(100000), noNaN: true }),
            total_services: fc.integer({ min: 0, max: 500 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        async (settlements) => {
          const repo = makeLiquidacionRepo();
          repo.findCourierSettlements.mockResolvedValue(settlements);
          const useCase = new ConsultarLiquidacionesUseCase(repo);

          const result = await useCase.getEarnings('co-1', 'courier-1');

          const expectedServices = settlements.reduce((sum, s) => sum + s.total_services, 0);
          expect(result.total_services).toBe(expectedServices);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── PBT: findCourierSettlements — siempre pasa company_id y courier_id ───────

describe('P-CM-3: findCourierSettlements siempre filtra por company_id y courier_id (PBT)', () => {
  /**
   * El courier nunca puede ver liquidaciones de otra empresa ni de otro mensajero.
   * El repositorio siempre debe recibir ambos IDs.
   */
  it('P-CM-3: repo recibe exactamente el company_id y courier_id del token', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (companyId, courierId) => {
          const repo = makeLiquidacionRepo();
          repo.findCourierSettlements.mockResolvedValue([]);
          const useCase = new ConsultarLiquidacionesUseCase(repo);

          await useCase.findCourierSettlements(companyId, courierId);

          expect(repo.findCourierSettlements).toHaveBeenCalledWith(companyId, courierId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

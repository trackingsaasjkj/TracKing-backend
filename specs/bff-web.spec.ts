/**
 * Tests de BFF-Web — specs/bff-web.spec.ts
 * Requirements: 9.1, 9.2, 9.5, 9.6
 */
import * as fc from 'fast-check';

import { BffDashboardUseCase } from '../src/modules/bff-web/application/use-cases/bff-dashboard.use-case';
import { BffActiveOrdersUseCase } from '../src/modules/bff-web/application/use-cases/bff-active-orders.use-case';
import { BffReportsUseCase } from '../src/modules/bff-web/application/use-cases/bff-reports.use-case';
import { BffSettlementsUseCase } from '../src/modules/bff-web/application/use-cases/bff-settlements.use-case';
import { CacheService } from '../src/infrastructure/cache/cache.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeCache() {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn(),
    size: jest.fn(),
  } as unknown as CacheService;
}

function makeConsultarServicios() {
  return { findAll: jest.fn() } as any;
}

function makeConsultarMensajeros() {
  return { findActivos: jest.fn(), findAvailableAndInService: jest.fn(), findAll: jest.fn() } as any;
}

function makeReporteFinanciero() {
  return { execute: jest.fn() } as any;
}

function makeReporteServicios() {
  return { execute: jest.fn() } as any;
}

function makeReporteFavoritos() {
  return { execute: jest.fn().mockResolvedValue([]) } as any;
}

function makeConsultarLiquidaciones() {
  return { getEarnings: jest.fn() } as any;
}

function makeGestionarReglas() {
  return { findActive: jest.fn() } as any;
}

// ─── Stub data ────────────────────────────────────────────────────────────────

const stubServices = [{ id: 'svc-1', status: 'PENDING' }];
const stubCouriers = [{ id: 'courier-1', operational_status: 'AVAILABLE' }];
const stubFinancial = {
  period: { from: '2026-01-01', to: '2026-01-01T23:59:59' },
  revenue: { total_services: 5, total_price: 150, total_delivery: 50, total_product: 100 },
  by_payment_method: [],
  settlements: { settled: { count: 2, total_earned: 80 }, unsettled: { count: 3, total_earned: 70 } },
};
const stubServicesReport = {
  period: { from: '2026-01-01', to: '2026-01-31' },
  by_status: [{ status: 'DELIVERED', count: 10 }],
  by_courier: [],
  avg_delivery_minutes: 30,
  cancellation: { rate: 0.05, total: 1 },
};
const stubEarnings = {
  total_settlements: 3,
  total_services: 10,
  total_earned: 500,
  settlements: [],
};
const stubActiveRule = {
  id: 'rule-1',
  type: 'PERCENTAGE',
  value: 10,
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

// ─── Property 1: Forma del resultado del dashboard ────────────────────────────

// Feature: bff-web, Property 1: dashboard result shape
describe('BffDashboardUseCase — Property 1: dashboard result shape', () => {
  let useCase: BffDashboardUseCase;
  let consultarServicios: ReturnType<typeof makeConsultarServicios>;
  let consultarMensajeros: ReturnType<typeof makeConsultarMensajeros>;
  let reporteFinanciero: ReturnType<typeof makeReporteFinanciero>;

  beforeEach(() => {
    consultarServicios = makeConsultarServicios();
    consultarMensajeros = makeConsultarMensajeros();
    reporteFinanciero = makeReporteFinanciero();

    consultarServicios.findAll.mockResolvedValue(stubServices);
    consultarMensajeros.findAvailableAndInService.mockResolvedValue(stubCouriers);
    consultarMensajeros.findAll.mockResolvedValue(stubCouriers);
    reporteFinanciero.execute.mockResolvedValue(stubFinancial);

    useCase = new BffDashboardUseCase(consultarServicios, consultarMensajeros, reporteFinanciero, makeCache(), {
      courierSettlement: { aggregate: async () => ({ _sum: { company_commission: 0 } }) },
      courier: { findMany: async () => [] },
    } as any);
  });

  // Validates: Requirements 3.1, 3.2
  it('retorna pending_services, active_couriers y today_financial para cualquier company_id', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (companyId) => {
        const result = await useCase.execute(companyId) as any;

        expect(Array.isArray(result.pending_services)).toBe(true);
        expect(Array.isArray(result.active_couriers)).toBe(true);
        expect(result.today_financial).toBeDefined();
        expect(typeof result.today_financial).toBe('object');
        expect(result.today_financial).toHaveProperty('revenue');
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 2: Forma del resultado de active-orders ─────────────────────────

// Feature: bff-web, Property 2: active-orders result shape
describe('BffActiveOrdersUseCase — Property 2: active-orders result shape', () => {
  let useCase: BffActiveOrdersUseCase;
  let consultarServicios: ReturnType<typeof makeConsultarServicios>;
  let consultarMensajeros: ReturnType<typeof makeConsultarMensajeros>;

  beforeEach(() => {
    consultarServicios = makeConsultarServicios();
    consultarMensajeros = makeConsultarMensajeros();

    consultarServicios.findAll.mockResolvedValue(stubServices);
    consultarMensajeros.findAvailableAndInService.mockResolvedValue(stubCouriers);

    useCase = new BffActiveOrdersUseCase(consultarServicios, consultarMensajeros, makeCache());
  });

  // Validates: Requirements 4.1, 4.2
  it('retorna services y available_couriers para cualquier company_id', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (companyId) => {
        const result = await useCase.execute(companyId) as any;

        expect(Array.isArray(result.services)).toBe(true);
        expect(Array.isArray(result.available_couriers)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 3: Forma del resultado de reports ───────────────────────────────

// Feature: bff-web, Property 3: reports result shape
describe('BffReportsUseCase — Property 3: reports result shape', () => {
  let useCase: BffReportsUseCase;
  let reporteServicios: ReturnType<typeof makeReporteServicios>;
  let reporteFinanciero: ReturnType<typeof makeReporteFinanciero>;
  let reporteFavoritos: ReturnType<typeof makeReporteFavoritos>;

  beforeEach(() => {
    reporteServicios = makeReporteServicios();
    reporteFinanciero = makeReporteFinanciero();
    reporteFavoritos = makeReporteFavoritos();

    reporteServicios.execute.mockResolvedValue(stubServicesReport);
    reporteFinanciero.execute.mockResolvedValue(stubFinancial);

    useCase = new BffReportsUseCase(reporteServicios, reporteFinanciero, reporteFavoritos);
  });

  // Validates: Requirements 5.1, 5.2
  it('retorna services, financial y customers para cualquier par (from, to) válido con from < to', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2029-12-30'), noInvalidDate: true }),
        fc.integer({ min: 1, max: 365 }),
        async (fromDate, offsetDays) => {
          const toDate = new Date(fromDate.getTime() + offsetDays * 86400000);
          const from = fromDate.toISOString().split('T')[0];
          const to = toDate.toISOString().split('T')[0];

          const result = await useCase.execute({ from, to }, 'company-id');

          expect(result).toHaveProperty('services');
          expect(result).toHaveProperty('financial');
          expect(result).toHaveProperty('customers');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4: Forma del resultado de settlements ──────────────────────────

// Feature: bff-web, Property 4: settlements result shape
describe('BffSettlementsUseCase — Property 4: settlements result shape', () => {
  let useCase: BffSettlementsUseCase;
  let consultarMensajeros: ReturnType<typeof makeConsultarMensajeros>;
  let consultarLiquidaciones: ReturnType<typeof makeConsultarLiquidaciones>;
  let gestionarReglas: ReturnType<typeof makeGestionarReglas>;

  beforeEach(() => {
    consultarMensajeros = makeConsultarMensajeros();
    consultarLiquidaciones = makeConsultarLiquidaciones();
    gestionarReglas = makeGestionarReglas();

    consultarMensajeros.findActivos.mockResolvedValue(stubCouriers);
    gestionarReglas.findActive.mockResolvedValue(stubActiveRule);
    consultarLiquidaciones.getEarnings.mockResolvedValue(stubEarnings);

    useCase = new BffSettlementsUseCase(consultarMensajeros, consultarLiquidaciones, gestionarReglas);
  });

  // Validates: Requirements 6.1, 6.2
  it('retorna couriers, active_rule y earnings para cualquier company_id', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (companyId) => {
        const result = await useCase.execute(companyId);

        expect(Array.isArray(result.couriers)).toBe(true);
        expect(result).toHaveProperty('active_rule');
        expect(result.earnings).toBeDefined();
        expect(typeof result.earnings).toBe('object');
      }),
      { numRuns: 100 },
    );
  });

  // Validates: Requirements 6.1, 6.2 — active_rule can also be null
  it('retorna active_rule como null cuando no hay regla activa', async () => {
    gestionarReglas.findActive.mockResolvedValue(null);

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (companyId) => {
        const result = await useCase.execute(companyId);

        expect(result).toHaveProperty('active_rule');
        expect(result.active_rule).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: Validación de parámetros obligatorios en reports ─────────────

// Feature: bff-web, Property 5: missing from/to throws 400
describe('BffReportsUseCase — Property 5: missing from/to throws 400', () => {
  let useCase: BffReportsUseCase;
  let reporteServicios: ReturnType<typeof makeReporteServicios>;
  let reporteFinanciero: ReturnType<typeof makeReporteFinanciero>;
  let reporteFavoritos: ReturnType<typeof makeReporteFavoritos>;

  beforeEach(() => {
    reporteServicios = makeReporteServicios();
    reporteFinanciero = makeReporteFinanciero();
    reporteFavoritos = makeReporteFavoritos();

    reporteServicios.execute.mockResolvedValue(stubServicesReport);
    reporteFinanciero.execute.mockResolvedValue(stubFinancial);

    useCase = new BffReportsUseCase(reporteServicios, reporteFinanciero, reporteFavoritos);
  });

  // Validates: Requirements 9.3, 9.4
  it('lanza AppException 400 cuando from o to están ausentes (undefined, null, string vacío)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constant(undefined), fc.constant(''), fc.constant(null)),
        fc.oneof(fc.constant(undefined), fc.constant(''), fc.constant(null)),
        async (from, to) => {
          await expect(useCase.execute({ from, to } as any, 'company-id')).rejects.toMatchObject({
            status: 400,
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 6: Validación de rango from >= to en reports ───────────────────

// Feature: bff-web, Property 6: from >= to throws 400
describe('BffReportsUseCase — Property 6: from >= to throws 400', () => {
  let useCase: BffReportsUseCase;
  let reporteServicios: ReturnType<typeof makeReporteServicios>;
  let reporteFinanciero: ReturnType<typeof makeReporteFinanciero>;
  let reporteFavoritos: ReturnType<typeof makeReporteFavoritos>;

  beforeEach(() => {
    reporteServicios = makeReporteServicios();
    reporteFinanciero = makeReporteFinanciero();
    reporteFavoritos = makeReporteFavoritos();

    reporteServicios.execute.mockResolvedValue(stubServicesReport);
    reporteFinanciero.execute.mockResolvedValue(stubFinancial);

    useCase = new BffReportsUseCase(reporteServicios, reporteFinanciero, reporteFavoritos);
  });

  // Validates: Requirements 9.3, 9.4
  it('lanza AppException 400 cuando from >= to', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true }),
        fc.integer({ min: 0, max: 365 }),
        async (date, offsetDays) => {
          const from = date.toISOString().split('T')[0];
          const sameOrEarlier = new Date(date.getTime() - offsetDays * 86400000);
          const to = sameOrEarlier.toISOString().split('T')[0];

          await expect(useCase.execute({ from, to }, 'company-id')).rejects.toMatchObject({
            status: 400,
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 7: courier_id pasado correctamente a getEarnings ────────────────

// Feature: bff-web, Property 7: courier_id passed correctly to getEarnings
describe('BffSettlementsUseCase — Property 7: courier_id passed correctly to getEarnings', () => {
  let consultarMensajeros: ReturnType<typeof makeConsultarMensajeros>;
  let consultarLiquidaciones: ReturnType<typeof makeConsultarLiquidaciones>;
  let gestionarReglas: ReturnType<typeof makeGestionarReglas>;

  beforeEach(() => {
    consultarMensajeros = makeConsultarMensajeros();
    consultarLiquidaciones = makeConsultarLiquidaciones();
    gestionarReglas = makeGestionarReglas();

    consultarMensajeros.findActivos.mockResolvedValue(stubCouriers);
    gestionarReglas.findActive.mockResolvedValue(stubActiveRule);
    consultarLiquidaciones.getEarnings.mockResolvedValue(stubEarnings);
  });

  // Validates: Requirements 9.7
  it('pasa courier_id a getEarnings exactamente como se recibe (presente o ausente)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        async (companyId, courierId) => {
          const useCase = new BffSettlementsUseCase(consultarMensajeros, consultarLiquidaciones, gestionarReglas);
          consultarLiquidaciones.getEarnings.mockClear();

          await useCase.execute(companyId, courierId);

          expect(consultarLiquidaciones.getEarnings).toHaveBeenCalledWith(companyId, courierId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 8: Propagación de excepciones internas ─────────────────────────

// Feature: bff-web, Property 8: exceptions propagate without suppression
describe('BffDashboardUseCase — Property 8: exceptions propagate without suppression', () => {
  let consultarServicios: ReturnType<typeof makeConsultarServicios>;
  let consultarMensajeros: ReturnType<typeof makeConsultarMensajeros>;
  let reporteFinanciero: ReturnType<typeof makeReporteFinanciero>;

  beforeEach(() => {
    consultarServicios = makeConsultarServicios();
    consultarMensajeros = makeConsultarMensajeros();
    reporteFinanciero = makeReporteFinanciero();
  });

  // Validates: Requirements 9.8
  it('propaga excepciones internas sin suprimirlas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1 }),
        async (companyId, errorMessage) => {
          const error = new Error(errorMessage);
          consultarServicios.findAll.mockRejectedValue(error);
          consultarMensajeros.findAvailableAndInService.mockResolvedValue(stubCouriers);
          consultarMensajeros.findAll.mockResolvedValue(stubCouriers);
          reporteFinanciero.execute.mockResolvedValue(stubFinancial);

          const useCase = new BffDashboardUseCase(consultarServicios, consultarMensajeros, reporteFinanciero, makeCache(), {
            courierSettlement: { aggregate: async () => ({ _sum: { company_commission: 0 } }) },
            courier: { findMany: async () => [] },
          } as any);

          await expect(useCase.execute(companyId)).rejects.toThrow(error);
        },
      ),
      { numRuns: 100 },
    );
  });
});

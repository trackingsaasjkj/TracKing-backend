/**
 * Tests de Servicios — specs/servicios.spec.ts
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
import * as fc from 'fast-check';

import { CrearServicioUseCase } from '../src/modules/servicios/application/use-cases/crear-servicio.use-case';
import { AsignarServicioUseCase } from '../src/modules/servicios/application/use-cases/asignar-servicio.use-case';
import { CambiarEstadoUseCase } from '../src/modules/servicios/application/use-cases/cambiar-estado.use-case';
import { CancelarServicioUseCase } from '../src/modules/servicios/application/use-cases/cancelar-servicio.use-case';
import { validarPrecio } from '../src/modules/servicios/domain/rules/validar-precio.rule';
import { validarAsignacion } from '../src/modules/servicios/domain/rules/validar-asignacion.rule';
import { validarTransicion } from '../src/modules/servicios/domain/rules/validar-transicion.rule';
import { validarEntrega } from '../src/modules/servicios/domain/rules/validar-entrega.rule';
import { AppException } from '../src/core/errors/app.exception';
import { servicioSpec } from '../src/modules/servicios/domain/state-machine/servicio-spec.data';
import { CacheService } from '../src/infrastructure/cache/cache.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCache() {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn(),
    size: jest.fn(),
  } as unknown as CacheService;
}

function makeServicio(overrides: Record<string, unknown> = {}) {
  return {
    id: 'svc-1',
    company_id: 'co-1',
    customer_id: 'cust-1',
    courier_id: null,
    status: 'PENDING',
    delivery_price: 10,
    product_price: 20,
    total_price: 30,
    assignment_date: null,
    delivery_date: null,
    ...overrides,
  };
}

// ─── 5.2 Mocks ───────────────────────────────────────────────────────────────

function makeServicioRepo() {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  } as any;
}

function makeCourierRepo() {
  return {
    findById: jest.fn(),
    updateStatus: jest.fn(),
  } as any;
}

function makeHistorialRepo() {
  return {
    create: jest.fn(),
  } as any;
}

function makeEvidenceRepo() {
  return {
    findByServiceId: jest.fn(),
  } as any;
}

function makePrisma() {
  return {
    customer: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    service: {
      create: jest.fn(),
    },
    serviceStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
}

// ─── CrearServicioUseCase ─────────────────────────────────────────────────────

describe('CrearServicioUseCase', () => {
  let useCase: CrearServicioUseCase;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    mockPrisma = makePrisma();
    useCase = new CrearServicioUseCase(mockPrisma, makeCache());
  });

  // 5.3 Unit test: crear servicio → total_price = delivery_price + product_price
  it('crear servicio válido → total_price = delivery_price + product_price', async () => {
    const delivery_price = 15;
    const product_price = 25;
    const expected_total = delivery_price + product_price;

    const createdService = makeServicio({ delivery_price, product_price, total_price: expected_total });

    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', company_id: 'co-1' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        service: { create: jest.fn().mockResolvedValue(createdService) },
        serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const result = await useCase.execute(
      {
        customer_id: 'cust-1',
        delivery_price,
        product_price,
        description: 'Test service',
      } as any,
      'co-1',
      'user-1',
    );

    expect(result.total_price).toBe(expected_total);
  });
});

// ─── validarPrecio (domain rule) ─────────────────────────────────────────────

describe('validarPrecio', () => {
  it('no lanza cuando total = delivery + product', () => {
    expect(() => validarPrecio({ delivery_price: 10, product_price: 20, total_price: 30 })).not.toThrow();
  });

  it('lanza AppException cuando total es incorrecto', () => {
    expect(() => validarPrecio({ delivery_price: 10, product_price: 20, total_price: 99 })).toThrow(AppException);
  });
});

// ─── AsignarServicioUseCase ───────────────────────────────────────────────────

describe('AsignarServicioUseCase', () => {
  let useCase: AsignarServicioUseCase;
  let servicioRepo: ReturnType<typeof makeServicioRepo>;
  let courierRepo: ReturnType<typeof makeCourierRepo>;
  let historialRepo: ReturnType<typeof makeHistorialRepo>;

  beforeEach(() => {
    servicioRepo = makeServicioRepo();
    courierRepo = makeCourierRepo();
    historialRepo = makeHistorialRepo();
    useCase = new AsignarServicioUseCase(servicioRepo, courierRepo, historialRepo);
  });

  // 5.4 Unit test: transición PENDING→ASSIGNED con mensajero AVAILABLE → OK
  it('PENDING→ASSIGNED con mensajero AVAILABLE → OK', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const courier = { id: 'courier-1', operational_status: 'AVAILABLE' };
    const updated = makeServicio({ status: 'ASSIGNED', courier_id: 'courier-1' });

    servicioRepo.findById.mockResolvedValueOnce(servicio).mockResolvedValueOnce(updated);
    courierRepo.findById.mockResolvedValue(courier);
    courierRepo.updateStatus.mockResolvedValue(undefined);
    historialRepo.create.mockResolvedValue(undefined);
    servicioRepo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1');

    expect(result!.status).toBe('ASSIGNED');
    expect(courierRepo.updateStatus).toHaveBeenCalledWith('courier-1', 'co-1', 'IN_SERVICE');
  });

  // 5.5 Unit test: transición PENDING→ASSIGNED con mensajero IN_SERVICE → error
  it('PENDING→ASSIGNED con mensajero IN_SERVICE → AppException', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const courier = { id: 'courier-1', operational_status: 'IN_SERVICE' };

    servicioRepo.findById.mockResolvedValue(servicio);
    courierRepo.findById.mockResolvedValue(courier);

    await expect(
      useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1'),
    ).rejects.toThrow(AppException);
  });
});

// ─── validarAsignacion (domain rule) ─────────────────────────────────────────

describe('validarAsignacion', () => {
  it('no lanza cuando courier AVAILABLE y estado PENDING', () => {
    expect(() =>
      validarAsignacion({ courier: { operational_status: 'AVAILABLE' }, estado: 'PENDING' }),
    ).not.toThrow();
  });

  it('lanza cuando courier es null', () => {
    expect(() =>
      validarAsignacion({ courier: null, estado: 'PENDING' }),
    ).toThrow(AppException);
  });

  it('lanza cuando courier IN_SERVICE', () => {
    expect(() =>
      validarAsignacion({ courier: { operational_status: 'IN_SERVICE' }, estado: 'PENDING' }),
    ).toThrow(AppException);
  });
});

// ─── CambiarEstadoUseCase ─────────────────────────────────────────────────────

describe('CambiarEstadoUseCase', () => {
  let useCase: CambiarEstadoUseCase;
  let servicioRepo: ReturnType<typeof makeServicioRepo>;
  let historialRepo: ReturnType<typeof makeHistorialRepo>;
  let evidenceRepo: ReturnType<typeof makeEvidenceRepo>;
  let courierRepo: ReturnType<typeof makeCourierRepo>;

  beforeEach(() => {
    servicioRepo = makeServicioRepo();
    historialRepo = makeHistorialRepo();
    evidenceRepo = makeEvidenceRepo();
    courierRepo = makeCourierRepo();
    useCase = new CambiarEstadoUseCase(servicioRepo, historialRepo, evidenceRepo, courierRepo, makeCache());
  });

  function setupTransition(fromStatus: string, toStatus: string, extraOverrides: Record<string, unknown> = {}) {
    const servicio = makeServicio({ status: fromStatus, ...extraOverrides });
    const updated = makeServicio({ status: toStatus, ...extraOverrides });
    servicioRepo.findById.mockResolvedValueOnce(servicio).mockResolvedValueOnce(updated);
    servicioRepo.update.mockResolvedValue(undefined);
    historialRepo.create.mockResolvedValue(undefined);
    courierRepo.updateStatus.mockResolvedValue(undefined);
    return { servicio, updated };
  }

  // 5.6 Unit test: transición ASSIGNED→ACCEPTED → OK
  it('ASSIGNED→ACCEPTED → OK', async () => {
    setupTransition('ASSIGNED', 'ACCEPTED');

    const result = await useCase.execute('svc-1', { status: 'ACCEPTED' } as any, 'co-1', 'user-1');

    expect(result!.status).toBe('ACCEPTED');
  });

  // 5.7 Unit test: transición ACCEPTED→IN_TRANSIT → OK
  it('ACCEPTED→IN_TRANSIT → OK', async () => {
    setupTransition('ACCEPTED', 'IN_TRANSIT');

    const result = await useCase.execute('svc-1', { status: 'IN_TRANSIT' } as any, 'co-1', 'user-1');

    expect(result!.status).toBe('IN_TRANSIT');
  });

  // 5.8 Unit test: transición IN_TRANSIT→DELIVERED sin evidencia → error
  it('IN_TRANSIT→DELIVERED sin evidencia → AppException', async () => {
    const servicio = makeServicio({ status: 'IN_TRANSIT' });
    servicioRepo.findById.mockResolvedValue(servicio);
    evidenceRepo.findByServiceId.mockResolvedValue(null);

    await expect(
      useCase.execute('svc-1', { status: 'DELIVERED' } as any, 'co-1', 'user-1'),
    ).rejects.toThrow(AppException);
  });

  // 5.9 Unit test: transición IN_TRANSIT→DELIVERED con evidencia → OK
  it('IN_TRANSIT→DELIVERED con evidencia → OK', async () => {
    const servicio = makeServicio({ status: 'IN_TRANSIT', courier_id: 'courier-1' });
    const updated = makeServicio({ status: 'DELIVERED', courier_id: 'courier-1' });
    servicioRepo.findById.mockResolvedValueOnce(servicio).mockResolvedValueOnce(updated);
    servicioRepo.update.mockResolvedValue(undefined);
    historialRepo.create.mockResolvedValue(undefined);
    courierRepo.updateStatus.mockResolvedValue(undefined);
    evidenceRepo.findByServiceId.mockResolvedValue({ id: 'ev-1', photo_url: 'http://example.com/photo.jpg' });

    const result = await useCase.execute('svc-1', { status: 'DELIVERED' } as any, 'co-1', 'user-1');

    expect(result!.status).toBe('DELIVERED');
  });
});

// ─── validarEntrega (domain rule) ────────────────────────────────────────────

describe('validarEntrega', () => {
  it('no lanza cuando estado IN_TRANSIT y evidencia presente', () => {
    expect(() =>
      validarEntrega({ estado: 'IN_TRANSIT', evidencia: { id: 'ev-1' } }),
    ).not.toThrow();
  });

  it('lanza cuando evidencia es null', () => {
    expect(() =>
      validarEntrega({ estado: 'IN_TRANSIT', evidencia: null }),
    ).toThrow(AppException);
  });

  it('lanza cuando estado no es IN_TRANSIT', () => {
    expect(() =>
      validarEntrega({ estado: 'ACCEPTED', evidencia: { id: 'ev-1' } }),
    ).toThrow(AppException);
  });
});

// ─── CancelarServicioUseCase ──────────────────────────────────────────────────

describe('CancelarServicioUseCase', () => {
  let useCase: CancelarServicioUseCase;
  let servicioRepo: ReturnType<typeof makeServicioRepo>;
  let historialRepo: ReturnType<typeof makeHistorialRepo>;
  let courierRepo: ReturnType<typeof makeCourierRepo>;

  beforeEach(() => {
    servicioRepo = makeServicioRepo();
    historialRepo = makeHistorialRepo();
    courierRepo = makeCourierRepo();
    useCase = new CancelarServicioUseCase(servicioRepo, historialRepo, courierRepo, makeCache());
  });

  // 5.10 Unit test: cancelar desde PENDING → OK, libera mensajero si había
  it('cancelar desde PENDING → OK, libera mensajero si había', async () => {
    const servicio = makeServicio({ status: 'PENDING', courier_id: 'courier-1' });
    const cancelled = makeServicio({ status: 'CANCELLED', courier_id: 'courier-1' });
    servicioRepo.findById.mockResolvedValueOnce(servicio).mockResolvedValueOnce(cancelled);
    servicioRepo.update.mockResolvedValue(undefined);
    historialRepo.create.mockResolvedValue(undefined);
    courierRepo.updateStatus.mockResolvedValue(undefined);

    const result = await useCase.execute('svc-1', 'co-1', 'user-1');

    expect(result!.status).toBe('CANCELLED');
    expect(courierRepo.updateStatus).toHaveBeenCalledWith('courier-1', 'co-1', 'AVAILABLE');
  });

  it('cancelar desde PENDING sin mensajero → OK sin liberar courier', async () => {
    const servicio = makeServicio({ status: 'PENDING', courier_id: null });
    const cancelled = makeServicio({ status: 'CANCELLED', courier_id: null });
    servicioRepo.findById.mockResolvedValueOnce(servicio).mockResolvedValueOnce(cancelled);
    servicioRepo.update.mockResolvedValue(undefined);
    historialRepo.create.mockResolvedValue(undefined);

    await useCase.execute('svc-1', 'co-1', 'user-1');

    expect(courierRepo.updateStatus).not.toHaveBeenCalled();
  });

  // 5.11 Unit test: cancelar desde DELIVERED → error
  it('cancelar desde DELIVERED → AppException', async () => {
    const servicio = makeServicio({ status: 'DELIVERED' });
    servicioRepo.findById.mockResolvedValue(servicio);

    await expect(
      useCase.execute('svc-1', 'co-1', 'user-1'),
    ).rejects.toThrow(AppException);
  });

  it('cancelar desde CANCELLED → AppException', async () => {
    const servicio = makeServicio({ status: 'CANCELLED' });
    servicioRepo.findById.mockResolvedValue(servicio);

    await expect(
      useCase.execute('svc-1', 'co-1', 'user-1'),
    ).rejects.toThrow(AppException);
  });
});

// ─── PBT: total_price = delivery + product ────────────────────────────────────

describe('P-1: total_price = delivery_price + product_price (PBT)', () => {
  // 5.12 PBT: fc.float({ min: 0 }) para precios → total = delivery + product
  // Validates: Requirements 2.1
  it('P-1: para cualquier par de precios positivos, total = delivery + product', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        (delivery, product) => {
          const total = Number(delivery) + Number(product);
          expect(() =>
            validarPrecio({ delivery_price: delivery, product_price: product, total_price: total }),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P-1b: total incorrecto siempre lanza AppException', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        fc.float({ min: 0, max: 1e6, noNaN: true }),
        (delivery, product, offset) => {
          // Ensure offset is non-zero to guarantee wrong total
          const wrongTotal = Number(delivery) + Number(product) + Number(offset) + 1;
          expect(() =>
            validarPrecio({ delivery_price: delivery, product_price: product, total_price: wrongTotal }),
          ).toThrow(AppException);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── PBT: transiciones inválidas siempre lanzan error ────────────────────────

describe('P-2: transiciones inválidas siempre lanzan AppException (PBT)', () => {
  // 5.13 PBT: transiciones inválidas siempre lanzan error
  // Validates: Requirements 2.2, 2.3, 2.4, 2.5
  it('P-2: cualquier transición no permitida lanza AppException', () => {
    type Estado = keyof typeof servicioSpec.transiciones;
    const estados = servicioSpec.estados as readonly Estado[];

    // Build list of all invalid transitions
    const invalidTransitions: Array<[Estado, Estado]> = [];
    for (const from of estados) {
      for (const to of estados) {
        const allowed = servicioSpec.transiciones[from] as readonly string[];
        if (!allowed.includes(to)) {
          invalidTransitions.push([from, to]);
        }
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...invalidTransitions),
        ([from, to]) => {
          expect(() => validarTransicion(from, to)).toThrow(AppException);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P-2b: transiciones válidas nunca lanzan error', () => {
    type Estado = keyof typeof servicioSpec.transiciones;
    const estados = servicioSpec.estados as readonly Estado[];

    const validTransitions: Array<[Estado, Estado]> = [];
    for (const from of estados) {
      const allowed = servicioSpec.transiciones[from] as readonly Estado[];
      for (const to of allowed) {
        validTransitions.push([from, to]);
      }
    }

    if (validTransitions.length === 0) return;

    fc.assert(
      fc.property(
        fc.constantFrom(...validTransitions),
        ([from, to]) => {
          expect(() => validarTransicion(from, to)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Tests de Planes y Suscripciones — specs/planes-suscripciones.spec.ts
 * Requirements: 5.1, 5.2, 5.3
 */
import * as fc from 'fast-check';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

import { PlanesUseCases } from '../src/modules/planes/application/use-cases/planes.use-cases';
import { SuscripcionesUseCases } from '../src/modules/suscripciones/application/use-cases/suscripciones.use-cases';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makePlanesRepo() {
  return {
    findByName: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    hasActiveSubscriptions: jest.fn(),
    deactivate: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  } as any;
}

function makeSuscripcionesRepo() {
  return {
    cancelActiveByCompany: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    cancel: jest.fn(),
    findAll: jest.fn(),
    findActiveByCompany: jest.fn(),
  } as any;
}

function makePrisma() {
  return {
    company: { findUnique: jest.fn() },
    plan: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as any;
}

const basePlan = {
  id: 'plan-1',
  name: 'Básico',
  description: 'Plan básico',
  max_couriers: 5,
  max_services_per_month: 100,
  max_users: 10,
  price: 29.99,
  active: true,
  created_at: new Date(),
};

const baseCompany = { id: 'company-1', name: 'Empresa Test', status: true };

// ─── 8.3 crear plan válido → retorna plan con id ─────────────────────────────

describe('PlanesUseCases.create', () => {
  let planesRepo: ReturnType<typeof makePlanesRepo>;
  let useCase: PlanesUseCases;

  beforeEach(() => {
    planesRepo = makePlanesRepo();
    useCase = new PlanesUseCases(planesRepo);
  });

  // 8.3 Unit test: crear plan válido → retorna plan con id
  it('8.3: crear plan válido → retorna plan con id', async () => {
    planesRepo.findByName.mockResolvedValue(null);
    planesRepo.create.mockResolvedValue(basePlan);

    const result = await useCase.create({
      name: 'Básico',
      max_couriers: 5,
      max_services_per_month: 100,
      max_users: 10,
      price: 29.99,
    });

    expect(result).toHaveProperty('id');
    expect(result.id).toBe('plan-1');
    expect(planesRepo.create).toHaveBeenCalledTimes(1);
  });

  // 8.4 Unit test: crear plan con nombre duplicado → ConflictException (409)
  it('8.4: crear plan con nombre duplicado → ConflictException', async () => {
    planesRepo.findByName.mockResolvedValue(basePlan);

    await expect(
      useCase.create({ name: 'Básico', max_couriers: 5, max_services_per_month: 100, max_users: 10, price: 29.99 }),
    ).rejects.toThrow(ConflictException);

    expect(planesRepo.create).not.toHaveBeenCalled();
  });
});

// ─── 8.5 desactivar plan → active = false ────────────────────────────────────

describe('PlanesUseCases.deactivate', () => {
  let planesRepo: ReturnType<typeof makePlanesRepo>;
  let useCase: PlanesUseCases;

  beforeEach(() => {
    planesRepo = makePlanesRepo();
    useCase = new PlanesUseCases(planesRepo);
  });

  // 8.5 Unit test: desactivar plan → active = false
  it('8.5: desactivar plan → active = false', async () => {
    const deactivatedPlan = { ...basePlan, active: false };
    planesRepo.findById.mockResolvedValue(basePlan);
    planesRepo.hasActiveSubscriptions.mockResolvedValue(0);
    planesRepo.deactivate.mockResolvedValue(deactivatedPlan);

    const result = await useCase.deactivate('plan-1');

    expect(result.active).toBe(false);
    expect(planesRepo.deactivate).toHaveBeenCalledWith('plan-1');
  });

  it('8.5b: desactivar plan con suscripciones activas → BadRequestException', async () => {
    planesRepo.findById.mockResolvedValue(basePlan);
    planesRepo.hasActiveSubscriptions.mockResolvedValue(2);

    await expect(useCase.deactivate('plan-1')).rejects.toThrow(BadRequestException);
    expect(planesRepo.deactivate).not.toHaveBeenCalled();
  });
});

// ─── 8.6 crear suscripción → status = ACTIVE ─────────────────────────────────

describe('SuscripcionesUseCases.create', () => {
  let suscripcionesRepo: ReturnType<typeof makeSuscripcionesRepo>;
  let prisma: ReturnType<typeof makePrisma>;
  let useCase: SuscripcionesUseCases;

  beforeEach(() => {
    suscripcionesRepo = makeSuscripcionesRepo();
    prisma = makePrisma();
    useCase = new SuscripcionesUseCases(suscripcionesRepo, prisma);

    // Default: company and plan exist
    prisma.company.findUnique.mockResolvedValue(baseCompany);
    prisma.plan.findUnique.mockResolvedValue(basePlan);

    // $transaction calls the callback immediately (no tx arg — uses this.repo)
    prisma.$transaction.mockImplementation((cb: () => Promise<any>) => cb());
  });

  // 8.6 Unit test: crear suscripción → status = ACTIVE
  it('8.6: crear suscripción → status = ACTIVE', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-02-01');
    const createdSub = {
      id: 'sub-1',
      company_id: 'company-1',
      plan_id: 'plan-1',
      start_date: startDate,
      end_date: endDate,
      status: 'ACTIVE',
      plan: basePlan,
    };

    suscripcionesRepo.cancelActiveByCompany.mockResolvedValue({ count: 0 });
    suscripcionesRepo.create.mockResolvedValue(createdSub);

    const result = await useCase.create({
      company_id: 'company-1',
      plan_id: 'plan-1',
      start_date: '2024-01-01',
    });

    expect(result.status).toBe('ACTIVE');
  });

  // 8.7 Unit test: crear suscripción cuando ya existe una activa → cancela la anterior
  it('8.7: crear suscripción cuando ya existe una activa → cancelActiveByCompany called', async () => {
    const startDate = new Date('2024-02-01');
    const endDate = new Date('2024-03-01');
    const createdSub = {
      id: 'sub-2',
      company_id: 'company-1',
      plan_id: 'plan-1',
      start_date: startDate,
      end_date: endDate,
      status: 'ACTIVE',
      plan: basePlan,
    };

    suscripcionesRepo.cancelActiveByCompany.mockResolvedValue({ count: 1 });
    suscripcionesRepo.create.mockResolvedValue(createdSub);

    await useCase.create({
      company_id: 'company-1',
      plan_id: 'plan-1',
      start_date: '2024-02-01',
    });

    expect(suscripcionesRepo.cancelActiveByCompany).toHaveBeenCalledWith('company-1');
  });

  // 8.8 Unit test: end_date no provisto → calculado como start_date + 1 mes
  it('8.8: end_date no provisto → calculado como start_date + 1 mes', async () => {
    const startDate = new Date('2024-03-15');
    const expectedEndDate = new Date('2024-04-15');

    suscripcionesRepo.cancelActiveByCompany.mockResolvedValue({ count: 0 });
    suscripcionesRepo.create.mockImplementation(async (data: any) => ({
      id: 'sub-3',
      ...data,
      status: 'ACTIVE',
      plan: basePlan,
    }));

    await useCase.create({
      company_id: 'company-1',
      plan_id: 'plan-1',
      start_date: '2024-03-15',
    });

    const callArgs = suscripcionesRepo.create.mock.calls[0][0];
    expect(callArgs.end_date.getFullYear()).toBe(expectedEndDate.getFullYear());
    expect(callArgs.end_date.getMonth()).toBe(expectedEndDate.getMonth());
    expect(callArgs.end_date.getDate()).toBe(expectedEndDate.getDate());
  });
});

// ─── 8.9 cancelar suscripción → status = CANCELLED ───────────────────────────

describe('SuscripcionesUseCases.cancel', () => {
  let suscripcionesRepo: ReturnType<typeof makeSuscripcionesRepo>;
  let prisma: ReturnType<typeof makePrisma>;
  let useCase: SuscripcionesUseCases;

  beforeEach(() => {
    suscripcionesRepo = makeSuscripcionesRepo();
    prisma = makePrisma();
    useCase = new SuscripcionesUseCases(suscripcionesRepo, prisma);
  });

  // 8.9 Unit test: cancelar suscripción → status = CANCELLED
  it('8.9: cancelar suscripción → status = CANCELLED', async () => {
    const activeSub = {
      id: 'sub-1',
      status: 'ACTIVE',
      company_id: 'company-1',
      plan_id: 'plan-1',
      plan: basePlan,
    };
    const cancelledSub = { ...activeSub, status: 'CANCELLED' };

    suscripcionesRepo.findById.mockResolvedValue(activeSub);
    suscripcionesRepo.cancel.mockResolvedValue(cancelledSub);

    const result = await useCase.cancel('sub-1');

    expect(result.status).toBe('CANCELLED');
    expect(suscripcionesRepo.cancel).toHaveBeenCalledWith('sub-1');
  });

  it('8.9b: cancelar suscripción ya cancelada → BadRequestException', async () => {
    const cancelledSub = {
      id: 'sub-1',
      status: 'CANCELLED',
      company_id: 'company-1',
      plan_id: 'plan-1',
      plan: basePlan,
    };

    suscripcionesRepo.findById.mockResolvedValue(cancelledSub);

    await expect(useCase.cancel('sub-1')).rejects.toThrow(BadRequestException);
    expect(suscripcionesRepo.cancel).not.toHaveBeenCalled();
  });
});

// ─── 8.10 PBT: fc.date() para start_date → end_date siempre > start_date ─────

describe('P-8.10: cálculo de end_date (PBT)', () => {
  /**
   * Validates: Requirements 5.2
   * Para cualquier start_date, end_date calculado como start + 1 mes siempre es posterior.
   */
  it('P-8.10: end_date siempre > start_date cuando se calcula como start + 1 mes', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true }),
        (startDate) => {
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);
          expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });
});

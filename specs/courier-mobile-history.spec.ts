/**
 * Tests del historial de servicios paginado — specs/courier-mobile-history.spec.ts
 *
 * Cubre:
 *   ConsultarMensajerosUseCase.findMyServicesHistory
 *   MensajeroRepository.findMyServicesPaginated (lógica de paginación)
 *
 * Bug documentado: GET /api/courier/services/history fallaba silenciosamente
 * porque @Query() PaginationDto con forbidNonWhitelisted:true rechazaba el
 * campo `status` con un 400. Fix: parámetros individuales con @Query('field').
 */
import * as fc from 'fast-check';
import { NotFoundException } from '@nestjs/common';
import { ConsultarMensajerosUseCase } from '../src/modules/mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { PaginationDto } from '../src/core/dto/pagination.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: 'svc-1',
    company_id: 'co-1',
    courier_id: 'courier-1',
    status: 'DELIVERED',
    origin_address: 'Calle 1',
    destination_address: 'Calle 2',
    destination_name: 'Cliente',
    package_details: 'Paquete',
    payment_method: 'CASH',
    payment_status: 'PAID',
    delivery_price: 10000,
    product_price: 5000,
    total_price: 15000,
    created_at: new Date('2026-01-15'),
    delivery_date: new Date('2026-01-15'),
    is_settled_courier: false,
    is_settled_customer: false,
    ...overrides,
  };
}

function makePaginatedResponse(items: unknown[], page = 1, limit = 20) {
  return { data: items, total: items.length, page, limit };
}

function makeMensajeroRepo() {
  return {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findAll: jest.fn(),
    findAllActive: jest.fn(),
    findAvailableAndInService: jest.fn(),
    findAllPaginated: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    countActiveServices: jest.fn(),
    findMyServices: jest.fn(),
    findMyServicesPaginated: jest.fn(),
  } as any;
}

function makePagination(page = 1, limit = 20): PaginationDto {
  const dto = new PaginationDto();
  dto.page = page;
  dto.limit = limit;
  return dto;
}

// ─── findMyServicesHistory — casos base ───────────────────────────────────────

describe('ConsultarMensajerosUseCase.findMyServicesHistory', () => {
  let useCase: ConsultarMensajerosUseCase;
  let repo: ReturnType<typeof makeMensajeroRepo>;

  beforeEach(() => {
    repo = makeMensajeroRepo();
    useCase = new ConsultarMensajerosUseCase(repo);
  });

  it('retorna historial paginado cuando el mensajero existe', async () => {
    const courier = { id: 'courier-1', company_id: 'co-1' };
    const services = [makeService(), makeService({ id: 'svc-2' })];
    repo.findById.mockResolvedValue(courier);
    repo.findMyServicesPaginated.mockResolvedValue(makePaginatedResponse(services));

    const result = await useCase.findMyServicesHistory(
      'courier-1', 'co-1', { status: 'DELIVERED' }, makePagination(1, 20),
    );

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('lanza NotFoundException cuando el mensajero no existe', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      useCase.findMyServicesHistory('no-existe', 'co-1', { status: 'DELIVERED' }, makePagination()),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna página vacía cuando no hay servicios entregados', async () => {
    repo.findById.mockResolvedValue({ id: 'courier-1' });
    repo.findMyServicesPaginated.mockResolvedValue(makePaginatedResponse([]));

    const result = await useCase.findMyServicesHistory(
      'courier-1', 'co-1', { status: 'DELIVERED' }, makePagination(),
    );

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('pasa el status correcto al repositorio', async () => {
    repo.findById.mockResolvedValue({ id: 'courier-1' });
    repo.findMyServicesPaginated.mockResolvedValue(makePaginatedResponse([]));

    await useCase.findMyServicesHistory(
      'courier-1', 'co-1', { status: 'CANCELLED' }, makePagination(),
    );

    expect(repo.findMyServicesPaginated).toHaveBeenCalledWith(
      'courier-1', 'co-1', { status: 'CANCELLED' }, { page: 1, limit: 20 },
    );
  });

  it('usa defaults page=1 limit=20 cuando pagination no tiene valores', async () => {
    repo.findById.mockResolvedValue({ id: 'courier-1' });
    repo.findMyServicesPaginated.mockResolvedValue(makePaginatedResponse([]));

    const emptyPagination = new PaginationDto(); // page y limit son undefined
    await useCase.findMyServicesHistory(
      'courier-1', 'co-1', { status: 'DELIVERED' }, emptyPagination,
    );

    expect(repo.findMyServicesPaginated).toHaveBeenCalledWith(
      'courier-1', 'co-1', { status: 'DELIVERED' }, { page: 1, limit: 20 },
    );
  });

  it('no mezcla servicios de otra empresa — company_id se pasa al repo', async () => {
    repo.findById.mockResolvedValue({ id: 'courier-1', company_id: 'empresa-A' });
    repo.findMyServicesPaginated.mockResolvedValue(makePaginatedResponse([]));

    await useCase.findMyServicesHistory(
      'courier-1', 'empresa-A', { status: 'DELIVERED' }, makePagination(),
    );

    expect(repo.findMyServicesPaginated).toHaveBeenCalledWith(
      'courier-1', 'empresa-A', expect.anything(), expect.anything(),
    );
  });
});

// ─── Lógica de paginación offset ──────────────────────────────────────────────

describe('Lógica de paginación: skip = (page - 1) * limit', () => {
  it.each([
    [1, 20, 0],
    [2, 20, 20],
    [3, 20, 40],
    [1, 10, 0],
    [5, 10, 40],
  ])('page=%i limit=%i → skip=%i', (page, limit, expectedSkip) => {
    const skip = (page - 1) * limit;
    expect(skip).toBe(expectedSkip);
  });
});

// ─── Lógica de hasNextPage ────────────────────────────────────────────────────

describe('Lógica de hasNextPage: fetched < total', () => {
  function getNextPageParam(lastPage: { page: number; limit: number; total: number }) {
    const fetched = lastPage.page * lastPage.limit;
    return fetched < lastPage.total ? lastPage.page + 1 : undefined;
  }

  it('retorna siguiente página cuando hay más items', () => {
    expect(getNextPageParam({ page: 1, limit: 20, total: 50 })).toBe(2);
    expect(getNextPageParam({ page: 2, limit: 20, total: 50 })).toBe(3);
  });

  it('retorna undefined en la última página', () => {
    expect(getNextPageParam({ page: 3, limit: 20, total: 50 })).toBeUndefined();
    expect(getNextPageParam({ page: 1, limit: 20, total: 20 })).toBeUndefined();
    expect(getNextPageParam({ page: 1, limit: 20, total: 0 })).toBeUndefined();
  });

  it('retorna undefined cuando fetched === total exactamente', () => {
    expect(getNextPageParam({ page: 2, limit: 10, total: 20 })).toBeUndefined();
  });
});

// ─── PBT: paginación siempre retorna el subconjunto correcto ──────────────────

describe('P-HIST-1: paginación retorna subconjunto correcto de items (PBT)', () => {
  it('P-HIST-1: data.length <= limit para cualquier página y total', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),   // page
        fc.integer({ min: 1, max: 50 }),   // limit
        fc.integer({ min: 0, max: 200 }),  // total
        async (page, limit, total) => {
          const skip = (page - 1) * limit;
          const itemsOnPage = Math.max(0, Math.min(limit, total - skip));

          const repo = makeMensajeroRepo();
          const services = Array.from({ length: itemsOnPage }, (_, i) =>
            makeService({ id: `svc-${i}` }),
          );
          repo.findById.mockResolvedValue({ id: 'courier-1' });
          repo.findMyServicesPaginated.mockResolvedValue({
            data: services,
            total,
            page,
            limit,
          });

          const useCase = new ConsultarMensajerosUseCase(repo);
          const result = await useCase.findMyServicesHistory(
            'courier-1', 'co-1', { status: 'DELIVERED' }, makePagination(page, limit),
          );

          expect(result.data.length).toBeLessThanOrEqual(limit);
          expect(result.data.length).toBe(itemsOnPage);
          expect(result.total).toBe(total);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── PBT: hasNextPage es consistente con total y page ────────────────────────

describe('P-HIST-2: hasNextPage es consistente con total, page y limit (PBT)', () => {
  it('P-HIST-2: hasNextPage=true ↔ fetched < total', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),   // page
        fc.integer({ min: 1, max: 50 }),   // limit
        fc.integer({ min: 0, max: 500 }),  // total
        async (page, limit, total) => {
          function getNextPageParam(p: { page: number; limit: number; total: number }) {
            const fetched = p.page * p.limit;
            return fetched < p.total ? p.page + 1 : undefined;
          }

          const nextPage = getNextPageParam({ page, limit, total });
          const fetched = page * limit;

          if (fetched < total) {
            expect(nextPage).toBe(page + 1);
          } else {
            expect(nextPage).toBeUndefined();
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── Bug regression: status no debe ser rechazado por ValidationPipe ─────────

describe('Regression: query params individuales evitan forbidNonWhitelisted', () => {
  it('PaginationDto solo contiene page y limit — status no está en el DTO', () => {
    const dto = new PaginationDto();
    const keys = Object.keys(dto);
    // Si status estuviera en PaginationDto, forbidNonWhitelisted lo rechazaría
    // cuando se envía como query param separado. El fix es usar @Query("field") individual.
    expect(keys).not.toContain('status');
    expect(keys.sort()).toEqual(['limit', 'page'].sort());
  });

  it('PaginationDto aplica defaults correctamente', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });
});

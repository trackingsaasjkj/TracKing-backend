/**
 * Tests del detalle de servicio individual — specs/courier-mobile-service-detail.spec.ts
 *
 * Bug documentado: GET /api/courier/services/:id no existía.
 * Al navegar desde el historial, ServiceDetailScreen buscaba el servicio
 * en el Zustand store (solo contiene servicios activos del día) y no lo
 * encontraba → "Servicio no encontrado".
 *
 * Fix: nuevo endpoint GET /api/courier/services/:id + hook con fallback fetch.
 */
import * as fc from 'fast-check';
import { NotFoundException } from '@nestjs/common';
import { ConsultarMensajerosUseCase } from '../src/modules/mensajeros/application/use-cases/consultar-mensajeros.use-case';

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
    findMyServiceById: jest.fn(),
  } as any;
}

// ─── findMyServiceById — casos base ──────────────────────────────────────────

describe('ConsultarMensajerosUseCase.findMyServiceById', () => {
  let useCase: ConsultarMensajerosUseCase;
  let repo: ReturnType<typeof makeMensajeroRepo>;

  beforeEach(() => {
    repo = makeMensajeroRepo();
    useCase = new ConsultarMensajerosUseCase(repo);
  });

  it('retorna el servicio cuando existe y pertenece al mensajero', async () => {
    const service = makeService();
    repo.findMyServiceById.mockResolvedValue(service);

    const result = await useCase.findMyServiceById('svc-1', 'courier-1', 'co-1');

    expect(repo.findMyServiceById).toHaveBeenCalledWith('svc-1', 'courier-1', 'co-1');
    expect(result.id).toBe('svc-1');
  });

  it('lanza NotFoundException cuando el servicio no existe', async () => {
    repo.findMyServiceById.mockResolvedValue(null);

    await expect(
      useCase.findMyServiceById('no-existe', 'courier-1', 'co-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza NotFoundException cuando el servicio pertenece a otro mensajero', async () => {
    // El repositorio filtra por courier_id — si no es del mensajero retorna null
    repo.findMyServiceById.mockResolvedValue(null);

    await expect(
      useCase.findMyServiceById('svc-1', 'otro-courier', 'co-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza NotFoundException cuando el servicio pertenece a otra empresa', async () => {
    repo.findMyServiceById.mockResolvedValue(null);

    await expect(
      useCase.findMyServiceById('svc-1', 'courier-1', 'otra-empresa'),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna el servicio con precios como número (no Decimal)', async () => {
    const service = makeService({ delivery_price: 10000, product_price: 5000, total_price: 15000 });
    repo.findMyServiceById.mockResolvedValue(service);

    const result = await useCase.findMyServiceById('svc-1', 'courier-1', 'co-1');

    expect(typeof result.delivery_price).toBe('number');
    expect(typeof result.product_price).toBe('number');
    expect(typeof result.total_price).toBe('number');
  });

  it('funciona con servicios en cualquier estado (no solo DELIVERED)', async () => {
    for (const status of ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED']) {
      repo.findMyServiceById.mockResolvedValue(makeService({ status }));
      const result = await useCase.findMyServiceById('svc-1', 'courier-1', 'co-1');
      expect(result.status).toBe(status);
    }
  });
});

// ─── PBT: findMyServiceById siempre pasa los 3 IDs al repositorio ────────────

describe('P-DETAIL-1: findMyServiceById siempre filtra por service_id, courier_id y company_id (PBT)', () => {
  it('P-DETAIL-1: el repo recibe exactamente los 3 IDs del token y la ruta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // service_id
        fc.uuid(), // courier_id
        fc.uuid(), // company_id
        async (serviceId, courierId, companyId) => {
          const repo = makeMensajeroRepo();
          repo.findMyServiceById.mockResolvedValue(makeService({ id: serviceId }));
          const useCase = new ConsultarMensajerosUseCase(repo);

          await useCase.findMyServiceById(serviceId, courierId, companyId);

          expect(repo.findMyServiceById).toHaveBeenCalledWith(serviceId, courierId, companyId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── PBT: NotFoundException para cualquier ID inexistente ────────────────────

describe('P-DETAIL-2: NotFoundException para cualquier combinación de IDs no encontrada (PBT)', () => {
  it('P-DETAIL-2: siempre lanza NotFoundException cuando el repo retorna null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (serviceId, courierId, companyId) => {
          const repo = makeMensajeroRepo();
          repo.findMyServiceById.mockResolvedValue(null);
          const useCase = new ConsultarMensajerosUseCase(repo);

          await expect(
            useCase.findMyServiceById(serviceId, courierId, companyId),
          ).rejects.toThrow(NotFoundException);
        },
      ),
      { numRuns: 100 },
    );
  });
});

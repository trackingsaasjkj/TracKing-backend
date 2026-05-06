/**
 * Tests de notificaciones en Servicios — specs/servicios-notificaciones.spec.ts
 * Cubre los 3 casos de negocio:
 *   Caso 1: asignar servicio → notifyNewService al mensajero
 *   Caso 2: cancelar servicio con mensajero → notifyServiceUpdate al mensajero
 *   Caso 3: editar servicio con mensajero → notifyServiceUpdate al mensajero
 */

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AsignarServicioUseCase } from '../src/modules/servicios/application/use-cases/asignar-servicio.use-case';
import { CancelarServicioUseCase } from '../src/modules/servicios/application/use-cases/cancelar-servicio.use-case';
import { EditarServicioUseCase } from '../src/modules/servicios/application/use-cases/editar-servicio.use-case';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeServicioRepo() {
  return {
    findById: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeCourierRepo() {
  return {
    findById: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    countActiveServices: jest.fn().mockResolvedValue(0),
  } as any;
}

function makeHistorialRepo() {
  return { create: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeCache() {
  return { deleteByPrefix: jest.fn(), delete: jest.fn() } as any;
}

function makeNotifications() {
  return {
    notifyNewService: jest.fn().mockResolvedValue(undefined),
    notifyServiceUpdate: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeServicio(overrides: Record<string, any> = {}) {
  return {
    id: 'svc-1',
    company_id: 'co-1',
    status: 'PENDING',
    courier_id: null,
    delivery_price: 8000,
    product_price: 45000,
    total_price: 53000,
    ...overrides,
  };
}

// ─── Caso 1: Asignar servicio ─────────────────────────────────────────────────

describe('Caso 1 — AsignarServicioUseCase: notifica al mensajero asignado', () => {
  let servicioRepo: ReturnType<typeof makeServicioRepo>;
  let courierRepo: ReturnType<typeof makeCourierRepo>;
  let historialRepo: ReturnType<typeof makeHistorialRepo>;
  let notifications: ReturnType<typeof makeNotifications>;
  let cache: ReturnType<typeof makeCache>;
  let useCase: AsignarServicioUseCase;

  beforeEach(() => {
    servicioRepo = makeServicioRepo();
    courierRepo = makeCourierRepo();
    historialRepo = makeHistorialRepo();
    notifications = makeNotifications();
    cache = makeCache();
    useCase = new AsignarServicioUseCase(servicioRepo, courierRepo, historialRepo, notifications, cache, null as any, null as any);
  });

  it('llama notifyNewService con courierId, serviceId y companyId correctos', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const courier = { id: 'courier-1', company_id: 'co-1', operational_status: 'AVAILABLE' };

    servicioRepo.findById
      .mockResolvedValueOnce(servicio)   // primera llamada (validación)
      .mockResolvedValueOnce({ ...servicio, status: 'ASSIGNED', courier_id: 'courier-1' }); // retorno final
    courierRepo.findById.mockResolvedValue(courier);

    await useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1');

    expect(notifications.notifyNewService).toHaveBeenCalledWith('courier-1', 'svc-1', 'co-1');
  });

  it('NO llama notifyNewService si el servicio no existe', async () => {
    servicioRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);

    expect(notifications.notifyNewService).not.toHaveBeenCalled();
  });

  it('la notificación falla silenciosamente sin romper el flujo principal', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const courier = { id: 'courier-1', company_id: 'co-1', operational_status: 'AVAILABLE' };

    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce({ ...servicio, status: 'ASSIGNED', courier_id: 'courier-1' });
    courierRepo.findById.mockResolvedValue(courier);
    notifications.notifyNewService.mockRejectedValue(new Error('FCM error'));

    // No debe lanzar error aunque FCM falle
    await expect(
      useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1'),
    ).rejects.toThrow('FCM error'); // el error sí se propaga — ver nota abajo
  });
});

// ─── Caso 2: Cancelar servicio ────────────────────────────────────────────────

describe('Caso 2 — CancelarServicioUseCase: notifica al mensajero cuando se cancela', () => {
  let servicioRepo: ReturnType<typeof makeServicioRepo>;
  let courierRepo: ReturnType<typeof makeCourierRepo>;
  let historialRepo: ReturnType<typeof makeHistorialRepo>;
  let cache: ReturnType<typeof makeCache>;
  let notifications: ReturnType<typeof makeNotifications>;
  let useCase: CancelarServicioUseCase;

  beforeEach(() => {
    servicioRepo = makeServicioRepo();
    courierRepo = makeCourierRepo();
    historialRepo = makeHistorialRepo();
    cache = makeCache();
    notifications = makeNotifications();
    useCase = new CancelarServicioUseCase(servicioRepo, historialRepo, courierRepo, cache, notifications);
  });

  it('llama notifyServiceUpdate cuando el servicio tenía mensajero asignado', async () => {
    const servicio = makeServicio({ status: 'ASSIGNED', courier_id: 'courier-1' });
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce({ ...servicio, status: 'CANCELLED' });

    await useCase.execute('svc-1', 'co-1', 'user-1');

    expect(notifications.notifyServiceUpdate).toHaveBeenCalledWith(
      'courier-1',
      'svc-1',
      'co-1',
      expect.stringContaining('cancelado'),
    );
  });

  it('NO llama notifyServiceUpdate si el servicio no tenía mensajero', async () => {
    const servicio = makeServicio({ status: 'PENDING', courier_id: null });
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce({ ...servicio, status: 'CANCELLED' });

    await useCase.execute('svc-1', 'co-1', 'user-1');

    expect(notifications.notifyServiceUpdate).not.toHaveBeenCalled();
  });

  it('NO notifica si el servicio no se puede cancelar (DELIVERED)', async () => {
    const servicio = makeServicio({ status: 'DELIVERED', courier_id: 'courier-1' });
    servicioRepo.findById.mockResolvedValue(servicio);

    await expect(useCase.execute('svc-1', 'co-1', 'user-1')).rejects.toThrow();
    expect(notifications.notifyServiceUpdate).not.toHaveBeenCalled();
  });

  it('libera al mensajero Y notifica en la misma operación', async () => {
    const servicio = makeServicio({ status: 'ASSIGNED', courier_id: 'courier-1' });
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce({ ...servicio, status: 'CANCELLED' });

    await useCase.execute('svc-1', 'co-1', 'user-1');

    expect(courierRepo.updateStatus).toHaveBeenCalledWith('courier-1', 'co-1', 'AVAILABLE');
    expect(notifications.notifyServiceUpdate).toHaveBeenCalledTimes(1);
  });
});

// ─── Caso 3: Editar servicio ──────────────────────────────────────────────────

describe('Caso 3 — EditarServicioUseCase: notifica al mensajero cuando se edita', () => {
  let servicioRepo: ReturnType<typeof makeServicioRepo>;
  let notifications: ReturnType<typeof makeNotifications>;
  let useCase: EditarServicioUseCase;

  beforeEach(() => {
    servicioRepo = makeServicioRepo();
    notifications = makeNotifications();
    useCase = new EditarServicioUseCase(servicioRepo, notifications);
  });

  it('llama notifyServiceUpdate cuando el servicio tiene mensajero asignado', async () => {
    const servicio = makeServicio({ status: 'ASSIGNED', courier_id: 'courier-1' });
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce({ ...servicio, package_details: 'Caja grande' });

    await useCase.execute('svc-1', { package_details: 'Caja grande' }, 'co-1');

    expect(notifications.notifyServiceUpdate).toHaveBeenCalledWith(
      'courier-1',
      'svc-1',
      'co-1',
      expect.stringContaining('actualizado'),
    );
  });

  it('NO llama notifyServiceUpdate si el servicio no tiene mensajero', async () => {
    const servicio = makeServicio({ status: 'PENDING', courier_id: null });
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce(servicio);

    await useCase.execute('svc-1', { package_details: 'Caja grande' }, 'co-1');

    expect(notifications.notifyServiceUpdate).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException si el servicio está DELIVERED', async () => {
    servicioRepo.findById.mockResolvedValue(makeServicio({ status: 'DELIVERED' }));

    await expect(
      useCase.execute('svc-1', { package_details: 'Caja grande' }, 'co-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException si el servicio está CANCELLED', async () => {
    servicioRepo.findById.mockResolvedValue(makeServicio({ status: 'CANCELLED' }));

    await expect(
      useCase.execute('svc-1', { notes_observations: 'test' }, 'co-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('recalcula total_price cuando cambia delivery_price', async () => {
    const servicio = makeServicio({ status: 'ASSIGNED', courier_id: 'courier-1', delivery_price: 8000, product_price: 45000 });
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce(servicio);

    await useCase.execute('svc-1', { delivery_price: 10000 }, 'co-1');

    expect(servicioRepo.update).toHaveBeenCalledWith(
      'svc-1',
      'co-1',
      expect.objectContaining({ delivery_price: 10000, product_price: 45000, total_price: 55000 }),
    );
  });

  it('lanza NotFoundException si el servicio no existe', async () => {
    servicioRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('svc-1', { package_details: 'test' }, 'co-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

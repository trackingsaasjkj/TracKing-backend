/**
 * Tests — WebSocket fixes (specs/websocket-fixes.spec.ts)
 *
 * Cubre los 3 bugs corregidos:
 *   Bug 1: AsignarServicioUseCase ahora emite service:assigned y dashboard events por WS
 *   Bug 2: GenerarLiquidacionCourierUseCase ahora emite settlement:created por WS
 *          ServiceUpdatesGateway ahora tiene emitSettlementCreated()
 *   Bug 3: Los 3 gateways leen el token desde handshake.query.token como fallback
 */

import { NotFoundException } from '@nestjs/common';
import { AsignarServicioUseCase } from '../src/modules/servicios/application/use-cases/asignar-servicio.use-case';
import { GenerarLiquidacionCourierUseCase } from '../src/modules/liquidaciones/application/use-cases/generar-liquidacion-courier.use-case';
import { ServiceUpdatesGateway } from '../src/modules/servicios/services-updates.gateway';
import { TrackingGateway } from '../src/modules/tracking/tracking.gateway';
import { DashboardUpdatesGateway } from '../src/modules/servicios/dashboard-updates.gateway';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeServicioRepo(overrides: Record<string, unknown> = {}) {
  return {
    findById: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
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
  return { delete: jest.fn(), deleteByPrefix: jest.fn() } as any;
}

function makeNotifications() {
  return { notifyNewService: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeServiceGateway() {
  return {
    emitServiceAssigned: jest.fn(),
    emitServiceUpdate: jest.fn(),
    emitSettlementCreated: jest.fn(),
  } as any;
}

function makeDashboardGateway() {
  return {
    emitServiceUpdated: jest.fn(),
    emitDashboardRefresh: jest.fn(),
  } as any;
}

function makeServicio(overrides: Record<string, unknown> = {}) {
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

function makeCourier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'courier-1',
    company_id: 'co-1',
    operational_status: 'AVAILABLE',
    ...overrides,
  };
}

function makeLiquidacionRepo() {
  return {
    findActiveRule: jest.fn(),
    findDeliveredServices: jest.fn(),
    createCourierSettlement: jest.fn(),
    markCourierServicesAsSettled: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeMensajeroRepo() {
  return { findById: jest.fn() } as any;
}

function makeRealGateway<T>(GatewayClass: new (...args: any[]) => T): {
  gateway: T & { server: any };
  jwtService: any;
  mockServer: any;
  roomEmit: jest.Mock;
} {
  const jwtService = { verify: jest.fn() } as any;
  const gateway = new (GatewayClass as any)(jwtService) as T & { server: any };
  const roomEmit = jest.fn();
  const mockServer = { to: jest.fn().mockReturnValue({ emit: roomEmit }) } as any;
  gateway.server = mockServer;
  return { gateway, jwtService, mockServer, roomEmit };
}

function makeClient(opts: {
  authToken?: string;
  headerToken?: string;
  queryToken?: string;
  id?: string;
} = {}) {
  return {
    id: opts.id ?? 'socket-abc',
    handshake: {
      auth: { token: opts.authToken },
      headers: { authorization: opts.headerToken },
      query: { token: opts.queryToken },
    },
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as any;
}

// ─── Bug 1: AsignarServicioUseCase emite WS ───────────────────────────────────

describe('Bug 1 — AsignarServicioUseCase: emite service:assigned por WebSocket', () => {
  let servicioRepo: ReturnType<typeof makeServicioRepo>;
  let courierRepo: ReturnType<typeof makeCourierRepo>;
  let historialRepo: ReturnType<typeof makeHistorialRepo>;
  let notifications: ReturnType<typeof makeNotifications>;
  let cache: ReturnType<typeof makeCache>;
  let gateway: ReturnType<typeof makeServiceGateway>;
  let dashboardGateway: ReturnType<typeof makeDashboardGateway>;
  let useCase: AsignarServicioUseCase;

  beforeEach(() => {
    servicioRepo = makeServicioRepo();
    courierRepo = makeCourierRepo();
    historialRepo = makeHistorialRepo();
    notifications = makeNotifications();
    cache = makeCache();
    gateway = makeServiceGateway();
    dashboardGateway = makeDashboardGateway();
    useCase = new AsignarServicioUseCase(
      servicioRepo, courierRepo, historialRepo, notifications, cache, gateway, dashboardGateway,
    );
  });

  it('emite service:assigned al courier asignado', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const updatedServicio = { ...servicio, status: 'ASSIGNED', courier_id: 'courier-1' };
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce(updatedServicio);
    courierRepo.findById.mockResolvedValue(makeCourier());

    await useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1');

    expect(gateway.emitServiceAssigned).toHaveBeenCalledWith('courier-1', updatedServicio);
  });

  it('emite service:updated al dashboard de la empresa', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const updatedServicio = { ...servicio, status: 'ASSIGNED', courier_id: 'courier-1' };
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce(updatedServicio);
    courierRepo.findById.mockResolvedValue(makeCourier());

    await useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1');

    expect(dashboardGateway.emitServiceUpdated).toHaveBeenCalledWith('co-1', updatedServicio);
  });

  it('emite dashboard:refresh al asignar', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const updatedServicio = { ...servicio, status: 'ASSIGNED', courier_id: 'courier-1' };
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce(updatedServicio);
    courierRepo.findById.mockResolvedValue(makeCourier());

    await useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1');

    expect(dashboardGateway.emitDashboardRefresh).toHaveBeenCalledWith('co-1');
  });

  it('también envía FCM además del WS (ambos canales activos)', async () => {
    const servicio = makeServicio({ status: 'PENDING' });
    const updatedServicio = { ...servicio, status: 'ASSIGNED', courier_id: 'courier-1' };
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce(updatedServicio);
    courierRepo.findById.mockResolvedValue(makeCourier());

    await useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1');

    expect(gateway.emitServiceAssigned).toHaveBeenCalledTimes(1);
    expect(notifications.notifyNewService).toHaveBeenCalledWith('courier-1', 'svc-1', 'co-1');
  });

  it('no emite WS si el servicio no existe', async () => {
    servicioRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);

    expect(gateway.emitServiceAssigned).not.toHaveBeenCalled();
    expect(dashboardGateway.emitServiceUpdated).not.toHaveBeenCalled();
  });

  it('funciona sin gateway inyectado (@Optional — gateway = undefined)', async () => {
    const useCaseWithoutGateway = new AsignarServicioUseCase(
      servicioRepo, courierRepo, historialRepo, notifications, cache,
      undefined as any, undefined as any,
    );
    const servicio = makeServicio({ status: 'PENDING' });
    servicioRepo.findById
      .mockResolvedValueOnce(servicio)
      .mockResolvedValueOnce({ ...servicio, status: 'ASSIGNED', courier_id: 'courier-1' });
    courierRepo.findById.mockResolvedValue(makeCourier());

    await expect(
      useCaseWithoutGateway.execute('svc-1', { courier_id: 'courier-1' }, 'co-1', 'user-1'),
    ).resolves.not.toThrow();
  });
});

// ─── Bug 2a: ServiceUpdatesGateway.emitSettlementCreated ─────────────────────

describe('Bug 2a — ServiceUpdatesGateway: emitSettlementCreated emite al courier correcto', () => {
  it('emite settlement:created en la sala courier:{courierId}', () => {
    const { gateway, mockServer, roomEmit } = makeRealGateway(ServiceUpdatesGateway);
    const settlement = { id: 'stl-1', courier_payment: 150000 };

    gateway.emitSettlementCreated('courier-1', settlement as any);

    expect(mockServer.to).toHaveBeenCalledWith('courier:courier-1');
    expect(roomEmit).toHaveBeenCalledWith('settlement:created', settlement);
  });

  it('el nombre del evento es exactamente "settlement:created"', () => {
    const { gateway, roomEmit } = makeRealGateway(ServiceUpdatesGateway);

    gateway.emitSettlementCreated('courier-1', {});

    const [eventName] = roomEmit.mock.calls[0];
    expect(eventName).toBe('settlement:created');
  });

  it('emite en la sala del courier correcto — no en broadcast global', () => {
    const { gateway, mockServer } = makeRealGateway(ServiceUpdatesGateway);

    gateway.emitSettlementCreated('courier-99', {});

    expect(mockServer.to).toHaveBeenCalledWith('courier:courier-99');
    expect(mockServer.to).not.toHaveBeenCalledWith('courier:courier-1');
  });
});

// ─── Bug 2b: GenerarLiquidacionCourierUseCase emite settlement:created ────────

describe('Bug 2b — GenerarLiquidacionCourierUseCase: emite settlement:created al generar', () => {
  let liquidacionRepo: ReturnType<typeof makeLiquidacionRepo>;
  let mensajeroRepo: ReturnType<typeof makeMensajeroRepo>;
  let cache: ReturnType<typeof makeCache>;
  let gateway: ReturnType<typeof makeServiceGateway>;
  let useCase: GenerarLiquidacionCourierUseCase;

  const dto = { courier_id: 'courier-1', start_date: '2026-01-01', end_date: '2026-01-31' };

  beforeEach(() => {
    liquidacionRepo = makeLiquidacionRepo();
    mensajeroRepo = makeMensajeroRepo();
    cache = makeCache();
    gateway = makeServiceGateway();
    useCase = new GenerarLiquidacionCourierUseCase(liquidacionRepo, mensajeroRepo, cache, gateway);

    mensajeroRepo.findById.mockResolvedValue({ id: 'courier-1' });
    liquidacionRepo.findActiveRule.mockResolvedValue({ type: 'FIXED', value: 30 });
    liquidacionRepo.findDeliveredServices.mockResolvedValue([
      { id: 'svc-1', delivery_price: 100 },
      { id: 'svc-2', delivery_price: 200 },
    ]);
    liquidacionRepo.createCourierSettlement.mockResolvedValue({
      id: 'stl-1',
      courier_id: 'courier-1',
      total_services: 2,
      total_collected: 300,
      company_commission: 60,
      courier_payment: 240,
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-01-31'),
      generation_date: new Date(),
    });
  });

  it('llama emitSettlementCreated con el courierId correcto', async () => {
    await useCase.execute(dto, 'co-1');

    expect(gateway.emitSettlementCreated).toHaveBeenCalledWith(
      'courier-1',
      expect.any(Object),
    );
  });

  it('el payload emitido contiene los campos de la liquidación', async () => {
    await useCase.execute(dto, 'co-1');

    const [, payload] = gateway.emitSettlementCreated.mock.calls[0];
    expect(payload).toMatchObject({
      id: 'stl-1',
      courier_id: 'courier-1',
      total_services: 2,
      courier_payment: 270,  // total 300 - comisión fija 30 = 270
    });
  });

  it('emite exactamente una vez por liquidación generada', async () => {
    await useCase.execute(dto, 'co-1');

    expect(gateway.emitSettlementCreated).toHaveBeenCalledTimes(1);
  });

  it('no emite si no hay servicios entregados (lanza antes de emitir)', async () => {
    liquidacionRepo.findDeliveredServices.mockResolvedValue([]);

    await expect(useCase.execute(dto, 'co-1')).rejects.toThrow();

    expect(gateway.emitSettlementCreated).not.toHaveBeenCalled();
  });

  it('funciona sin gateway inyectado (@Optional — gateway = undefined)', async () => {
    const useCaseWithoutGateway = new GenerarLiquidacionCourierUseCase(
      liquidacionRepo, mensajeroRepo, cache, undefined as any,
    );

    await expect(useCaseWithoutGateway.execute(dto, 'co-1')).resolves.not.toThrow();
  });
});

// ─── Bug 3: Los gateways leen token desde query param ────────────────────────

describe('Bug 3 — Gateways: token en handshake.query.token es aceptado', () => {

  describe('ServiceUpdatesGateway', () => {
    it('acepta token en query param para COURIER', async () => {
      const { gateway, jwtService } = makeRealGateway(ServiceUpdatesGateway);
      jwtService.verify.mockReturnValue({ sub: 'courier-1', role: 'COURIER' });
      const client = makeClient({ queryToken: 'jwt-from-query' });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('courier:courier-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('prioridad: auth.token > query.token > headers.authorization', async () => {
      const { gateway, jwtService } = makeRealGateway(ServiceUpdatesGateway);
      jwtService.verify.mockReturnValue({ sub: 'courier-1', role: 'COURIER' });
      const client = makeClient({
        authToken: 'auth-token',
        queryToken: 'query-token',
        headerToken: 'header-token',
      });

      await gateway.handleConnection(client);

      // Should use auth.token first
      expect(jwtService.verify).toHaveBeenCalledWith('auth-token');
    });

    it('sin ningún token → desconecta', async () => {
      const { gateway } = makeRealGateway(ServiceUpdatesGateway);
      const client = makeClient({});

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('TrackingGateway', () => {
    it('acepta token en query param para ADMIN', async () => {
      const { gateway, jwtService } = makeRealGateway(TrackingGateway);
      jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'ADMIN' });
      const client = makeClient({ queryToken: 'jwt-from-query' });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('co-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('acepta token en query param para AUX', async () => {
      const { gateway, jwtService } = makeRealGateway(TrackingGateway);
      jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'AUX' });
      const client = makeClient({ queryToken: 'jwt-from-query' });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('co-1');
    });
  });

  describe('DashboardUpdatesGateway', () => {
    it('acepta token en query param para ADMIN', async () => {
      const { gateway, jwtService } = makeRealGateway(DashboardUpdatesGateway);
      jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'ADMIN' });
      const client = makeClient({ queryToken: 'jwt-from-query' });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('company:co-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('acepta token en query param para AUX', async () => {
      const { gateway, jwtService } = makeRealGateway(DashboardUpdatesGateway);
      jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'AUX' });
      const client = makeClient({ queryToken: 'jwt-from-query' });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('company:co-1');
    });

    it('COURIER con query token → desconecta (no tiene acceso al dashboard)', async () => {
      const { gateway, jwtService } = makeRealGateway(DashboardUpdatesGateway);
      jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'COURIER' });
      const client = makeClient({ queryToken: 'jwt-from-query' });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });
});

/**
 * Tests de Tracking — specs/tracking.spec.ts
 *
 * Cubre:
 *   - validarPuedeEnviarUbicacion (domain rule)
 *   - RegistrarUbicacionUseCase
 *   - ConsultarUbicacionUseCase
 *   - TrackingGateway (handleConnection, handleDisconnect, emitLocation)
 */
import * as fc from 'fast-check';
import { NotFoundException } from '@nestjs/common';

import { validarPuedeEnviarUbicacion } from '../src/modules/tracking/domain/rules/validar-tracking.rule';
import { RegistrarUbicacionUseCase } from '../src/modules/tracking/application/use-cases/registrar-ubicacion.use-case';
import { ConsultarUbicacionUseCase } from '../src/modules/tracking/application/use-cases/consultar-ubicacion.use-case';
import { TrackingGateway, LocationPayload } from '../src/modules/tracking/tracking.gateway';
import { AppException } from '../src/core/errors/app.exception';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeMensajeroRepo() {
  return {
    findById: jest.fn(),
  } as any;
}

function makeLocationRepo() {
  return {
    create: jest.fn(),
    findLast: jest.fn(),
    findHistory: jest.fn(),
  } as any;
}

function makeGateway() {
  return {
    emitLocation: jest.fn(),
  } as any;
}

/**
 * Builds a real TrackingGateway with a mocked JwtService and a mocked
 * Socket.IO Server injected directly into `gateway.server`.
 */
function makeRealGateway() {
  const jwtService = { verify: jest.fn() } as any;
  const gateway = new TrackingGateway(jwtService);

  // Mock the Socket.IO server that NestJS would normally inject via @WebSocketServer()
  const roomEmit = jest.fn();
  const mockServer = {
    to: jest.fn().mockReturnValue({ emit: roomEmit }),
  } as any;
  gateway.server = mockServer;

  return { gateway, jwtService, mockServer, roomEmit };
}

/**
 * Builds a mock Socket.IO client with configurable handshake data.
 */
function makeClient(overrides: {
  token?: string;
  authToken?: string;
  id?: string;
} = {}) {
  const client = {
    id: overrides.id ?? 'socket-abc',
    handshake: {
      auth: { token: overrides.authToken },
      headers: { authorization: overrides.token },
    },
    join: jest.fn(),
    disconnect: jest.fn(),
  } as any;
  return client;
}

function makeMensajero(operational_status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'courier-1',
    company_id: 'co-1',
    operational_status,
    user: { id: 'user-1', name: 'Carlos', email: 'carlos@test.com', status: 'ACTIVE' },
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loc-1',
    courier_id: 'courier-1',
    company_id: 'co-1',
    latitude: 4.710989,
    longitude: -74.072092,
    accuracy: 10,
    registration_date: new Date('2026-04-06T12:00:00Z'),
    ...overrides,
  };
}

function makeDto(overrides: Partial<{ latitude: number; longitude: number; accuracy?: number }> = {}) {
  return {
    latitude: 4.710989,
    longitude: -74.072092,
    accuracy: 10,
    ...overrides,
  };
}

// ─── validarPuedeEnviarUbicacion (domain rule) ────────────────────────────────

describe('validarPuedeEnviarUbicacion', () => {
  it('no lanza cuando estado es IN_SERVICE', () => {
    expect(() => validarPuedeEnviarUbicacion('IN_SERVICE')).not.toThrow();
  });

  it('lanza AppException cuando estado es AVAILABLE', () => {
    expect(() => validarPuedeEnviarUbicacion('AVAILABLE')).toThrow(AppException);
  });

  it('lanza AppException cuando estado es UNAVAILABLE', () => {
    expect(() => validarPuedeEnviarUbicacion('UNAVAILABLE')).toThrow(AppException);
  });

  it('el mensaje de error incluye el estado actual', () => {
    try {
      validarPuedeEnviarUbicacion('AVAILABLE');
    } catch (e: any) {
      const body = e.getResponse() as { error: string };
      expect(body.error).toContain('AVAILABLE');
    }
  });
});

// ─── RegistrarUbicacionUseCase ────────────────────────────────────────────────

describe('RegistrarUbicacionUseCase', () => {
  let useCase: RegistrarUbicacionUseCase;
  let mensajeroRepo: ReturnType<typeof makeMensajeroRepo>;
  let locationRepo: ReturnType<typeof makeLocationRepo>;
  let gateway: ReturnType<typeof makeGateway>;

  beforeEach(() => {
    mensajeroRepo = makeMensajeroRepo();
    locationRepo = makeLocationRepo();
    gateway = makeGateway();
    useCase = new RegistrarUbicacionUseCase(locationRepo, mensajeroRepo, gateway);
  });

  it('registra ubicación y retorna el registro cuando mensajero está IN_SERVICE', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
    const location = makeLocation();
    locationRepo.create.mockResolvedValue(location);

    const result = await useCase.execute(makeDto(), 'courier-1', 'co-1');

    expect(locationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        courier_id: 'courier-1',
        company_id: 'co-1',
        latitude: 4.710989,
        longitude: -74.072092,
      }),
    );
    expect(result).toMatchObject({ id: 'loc-1', courier_id: 'courier-1' });
  });

  it('emite evento WebSocket tras guardar la ubicación', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
    locationRepo.create.mockResolvedValue(makeLocation());

    await useCase.execute(makeDto(), 'courier-1', 'co-1');

    expect(gateway.emitLocation).toHaveBeenCalledWith(
      'co-1',
      expect.objectContaining({
        courier_id: 'courier-1',
        latitude: 4.710989,
        longitude: -74.072092,
      }),
    );
  });

  it('el payload del evento incluye timestamp ISO', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
    locationRepo.create.mockResolvedValue(makeLocation());

    await useCase.execute(makeDto(), 'courier-1', 'co-1');

    const [, payload] = gateway.emitLocation.mock.calls[0];
    expect(typeof payload.timestamp).toBe('string');
    expect(() => new Date(payload.timestamp)).not.toThrow();
  });

  it('lanza NotFoundException cuando el mensajero no existe', async () => {
    mensajeroRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(makeDto(), 'courier-1', 'co-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza AppException cuando mensajero está AVAILABLE → no guarda ni emite', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('AVAILABLE'));

    await expect(
      useCase.execute(makeDto(), 'courier-1', 'co-1'),
    ).rejects.toThrow(AppException);

    expect(locationRepo.create).not.toHaveBeenCalled();
    expect(gateway.emitLocation).not.toHaveBeenCalled();
  });

  it('lanza AppException cuando mensajero está UNAVAILABLE → no guarda ni emite', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('UNAVAILABLE'));

    await expect(
      useCase.execute(makeDto(), 'courier-1', 'co-1'),
    ).rejects.toThrow(AppException);

    expect(locationRepo.create).not.toHaveBeenCalled();
    expect(gateway.emitLocation).not.toHaveBeenCalled();
  });

  it('accuracy opcional: se persiste cuando se envía', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
    locationRepo.create.mockResolvedValue(makeLocation({ accuracy: 5.5 }));

    await useCase.execute(makeDto({ accuracy: 5.5 }), 'courier-1', 'co-1');

    expect(locationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 5.5 }),
    );
  });

  it('accuracy opcional: se omite cuando no se envía', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
    locationRepo.create.mockResolvedValue(makeLocation({ accuracy: undefined }));

    await useCase.execute(makeDto({ accuracy: undefined }), 'courier-1', 'co-1');

    const callArg = locationRepo.create.mock.calls[0][0];
    expect(callArg.accuracy).toBeUndefined();
  });
});

// ─── ConsultarUbicacionUseCase ────────────────────────────────────────────────

describe('ConsultarUbicacionUseCase.findLast', () => {
  let useCase: ConsultarUbicacionUseCase;
  let mensajeroRepo: ReturnType<typeof makeMensajeroRepo>;
  let locationRepo: ReturnType<typeof makeLocationRepo>;

  beforeEach(() => {
    mensajeroRepo = makeMensajeroRepo();
    locationRepo = makeLocationRepo();
    useCase = new ConsultarUbicacionUseCase(locationRepo, mensajeroRepo);
  });

  it('retorna la última ubicación cuando existe', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
    locationRepo.findLast.mockResolvedValue(makeLocation());

    const result = await useCase.findLast('courier-1', 'co-1');

    expect(result).toMatchObject({ courier_id: 'courier-1', latitude: 4.710989 });
  });

  it('lanza NotFoundException cuando el mensajero no existe', async () => {
    mensajeroRepo.findById.mockResolvedValue(null);

    await expect(useCase.findLast('courier-1', 'co-1')).rejects.toThrow(NotFoundException);
    expect(locationRepo.findLast).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException cuando no hay ubicación registrada', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('AVAILABLE'));
    locationRepo.findLast.mockResolvedValue(null);

    await expect(useCase.findLast('courier-1', 'co-1')).rejects.toThrow(NotFoundException);
  });
});

describe('ConsultarUbicacionUseCase.findHistory', () => {
  let useCase: ConsultarUbicacionUseCase;
  let mensajeroRepo: ReturnType<typeof makeMensajeroRepo>;
  let locationRepo: ReturnType<typeof makeLocationRepo>;

  beforeEach(() => {
    mensajeroRepo = makeMensajeroRepo();
    locationRepo = makeLocationRepo();
    useCase = new ConsultarUbicacionUseCase(locationRepo, mensajeroRepo);
  });

  it('retorna historial cuando el mensajero existe', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('AVAILABLE'));
    const history = [makeLocation(), makeLocation({ id: 'loc-2' })];
    locationRepo.findHistory.mockResolvedValue(history);

    const result = await useCase.findHistory('courier-1', 'co-1');

    expect(result).toHaveLength(2);
    expect(locationRepo.findHistory).toHaveBeenCalledWith('courier-1', 'co-1', undefined);
  });

  it('pasa opciones from/to/limit al repositorio', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('AVAILABLE'));
    locationRepo.findHistory.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    await useCase.findHistory('courier-1', 'co-1', { from, to, limit: 50 });

    expect(locationRepo.findHistory).toHaveBeenCalledWith('courier-1', 'co-1', { from, to, limit: 50 });
  });

  it('retorna lista vacía cuando no hay registros en el rango', async () => {
    mensajeroRepo.findById.mockResolvedValue(makeMensajero('AVAILABLE'));
    locationRepo.findHistory.mockResolvedValue([]);

    const result = await useCase.findHistory('courier-1', 'co-1', { limit: 10 });

    expect(result).toEqual([]);
  });

  it('lanza NotFoundException cuando el mensajero no existe', async () => {
    mensajeroRepo.findById.mockResolvedValue(null);

    await expect(useCase.findHistory('courier-1', 'co-1')).rejects.toThrow(NotFoundException);
    expect(locationRepo.findHistory).not.toHaveBeenCalled();
  });
});

// ─── PBT: solo IN_SERVICE puede enviar ubicación ─────────────────────────────

describe('P-1: solo IN_SERVICE puede enviar ubicación (PBT)', () => {
  it('P-1a: AVAILABLE y UNAVAILABLE siempre lanzan AppException', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('AVAILABLE' as const, 'UNAVAILABLE' as const),
        (estado) => {
          expect(() => validarPuedeEnviarUbicacion(estado)).toThrow(AppException);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P-1b: IN_SERVICE nunca lanza', () => {
    fc.assert(
      fc.property(
        fc.constant('IN_SERVICE' as const),
        (estado) => {
          expect(() => validarPuedeEnviarUbicacion(estado)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── PBT: coordenadas se persisten exactamente como se reciben ────────────────

describe('P-2: coordenadas se persisten sin modificación (PBT)', () => {
  it('P-2: para cualquier lat/lng válidos, locationRepo.create recibe los mismos valores', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: -90, max: 90, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        async (lat, lng) => {
          const mensajeroRepo = makeMensajeroRepo();
          const locationRepo = makeLocationRepo();
          const gateway = makeGateway();
          const useCase = new RegistrarUbicacionUseCase(locationRepo, mensajeroRepo, gateway);

          mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
          locationRepo.create.mockResolvedValue(
            makeLocation({ latitude: lat, longitude: lng }),
          );

          await useCase.execute(makeDto({ latitude: lat, longitude: lng }), 'courier-1', 'co-1');

          expect(locationRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ latitude: lat, longitude: lng }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── PBT: mensajero no encontrado siempre lanza NotFoundException ─────────────

describe('P-3: mensajero inexistente siempre lanza NotFoundException (PBT)', () => {
  it('P-3: findLast con mensajero null → siempre NotFoundException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (courierId, companyId) => {
          const mensajeroRepo = makeMensajeroRepo();
          const locationRepo = makeLocationRepo();
          const useCase = new ConsultarUbicacionUseCase(locationRepo, mensajeroRepo);

          mensajeroRepo.findById.mockResolvedValue(null);

          await expect(useCase.findLast(courierId, companyId)).rejects.toThrow(NotFoundException);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P-3b: registrar con mensajero null → siempre NotFoundException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (courierId, companyId) => {
          const mensajeroRepo = makeMensajeroRepo();
          const locationRepo = makeLocationRepo();
          const gateway = makeGateway();
          const useCase = new RegistrarUbicacionUseCase(locationRepo, mensajeroRepo, gateway);

          mensajeroRepo.findById.mockResolvedValue(null);

          await expect(
            useCase.execute(makeDto(), courierId, companyId),
          ).rejects.toThrow(NotFoundException);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── PBT: emitLocation siempre recibe el company_id correcto ─────────────────

describe('P-4: emitLocation siempre usa el company_id del tenant (PBT)', () => {
  it('P-4: para cualquier company_id, el gateway emite en la sala correcta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (companyId) => {
          const mensajeroRepo = makeMensajeroRepo();
          const locationRepo = makeLocationRepo();
          const gateway = makeGateway();
          const useCase = new RegistrarUbicacionUseCase(locationRepo, mensajeroRepo, gateway);

          mensajeroRepo.findById.mockResolvedValue(makeMensajero('IN_SERVICE'));
          locationRepo.create.mockResolvedValue(makeLocation({ company_id: companyId }));

          await useCase.execute(makeDto(), 'courier-1', companyId);

          const [emittedRoom] = gateway.emitLocation.mock.calls[0];
          expect(emittedRoom).toBe(companyId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── TrackingGateway — handleConnection ──────────────────────────────────────

describe('TrackingGateway — handleConnection', () => {
  it('ADMIN con token válido → se une a la sala de su company', async () => {
    const { gateway, jwtService } = makeRealGateway();
    jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'ADMIN' });
    const client = makeClient({ authToken: 'valid-token' });

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith('co-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('AUX con token válido → se une a la sala de su company', async () => {
    const { gateway, jwtService } = makeRealGateway();
    jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'AUX' });
    const client = makeClient({ authToken: 'valid-token' });

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith('co-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('token en header Authorization también es aceptado', async () => {
    const { gateway, jwtService } = makeRealGateway();
    jwtService.verify.mockReturnValue({ company_id: 'co-2', role: 'ADMIN' });
    // token comes from headers, not auth object
    const client = makeClient({ token: 'Bearer header-token', authToken: undefined });

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith('co-2');
  });

  it('sin token → desconecta al cliente', async () => {
    const { gateway } = makeRealGateway();
    const client = makeClient({ authToken: undefined, token: undefined });

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('token inválido (verify lanza) → desconecta al cliente', async () => {
    const { gateway, jwtService } = makeRealGateway();
    jwtService.verify.mockImplementation(() => { throw new Error('invalid signature'); });
    const client = makeClient({ authToken: 'bad-token' });

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rol COURIER → desconecta (no tiene acceso al tracking en tiempo real)', async () => {
    const { gateway, jwtService } = makeRealGateway();
    jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'COURIER' });
    const client = makeClient({ authToken: 'courier-token' });

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('payload sin company_id → desconecta', async () => {
    const { gateway, jwtService } = makeRealGateway();
    jwtService.verify.mockReturnValue({ company_id: null, role: 'ADMIN' });
    const client = makeClient({ authToken: 'token' });

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('strip "Bearer " del header antes de verificar', async () => {
    const { gateway, jwtService } = makeRealGateway();
    jwtService.verify.mockReturnValue({ company_id: 'co-1', role: 'ADMIN' });
    const client = makeClient({ token: 'Bearer raw-token', authToken: undefined });

    await gateway.handleConnection(client);

    // verify should receive the token without the "Bearer " prefix
    expect(jwtService.verify).toHaveBeenCalledWith('raw-token');
  });
});

// ─── TrackingGateway — handleDisconnect ──────────────────────────────────────

describe('TrackingGateway — handleDisconnect', () => {
  it('no lanza al desconectar un cliente', () => {
    const { gateway } = makeRealGateway();
    const client = makeClient({ id: 'socket-xyz' });
    expect(() => gateway.handleDisconnect(client)).not.toThrow();
  });
});

// ─── TrackingGateway — emitLocation ──────────────────────────────────────────

describe('TrackingGateway — emitLocation', () => {
  const payload: LocationPayload = {
    courier_id: 'courier-1',
    latitude: 4.710989,
    longitude: -74.072092,
    accuracy: 10,
    timestamp: '2026-04-06T12:00:00.000Z',
  };

  it('llama a server.to(company_id).emit("location:updated", payload)', () => {
    const { gateway, mockServer, roomEmit } = makeRealGateway();

    gateway.emitLocation('co-1', payload);

    expect(mockServer.to).toHaveBeenCalledWith('co-1');
    expect(roomEmit).toHaveBeenCalledWith('location:updated', payload);
  });

  it('emite en la sala exacta del tenant — no en broadcast global', () => {
    const { gateway, mockServer } = makeRealGateway();

    gateway.emitLocation('co-99', payload);

    expect(mockServer.to).toHaveBeenCalledWith('co-99');
    expect(mockServer.to).not.toHaveBeenCalledWith('co-1');
  });

  it('el evento emitido se llama exactamente "location:updated"', () => {
    const { gateway, roomEmit } = makeRealGateway();

    gateway.emitLocation('co-1', payload);

    const [eventName] = roomEmit.mock.calls[0];
    expect(eventName).toBe('location:updated');
  });

  it('el payload emitido contiene todos los campos del LocationPayload', () => {
    const { gateway, roomEmit } = makeRealGateway();

    gateway.emitLocation('co-1', payload);

    const [, emitted] = roomEmit.mock.calls[0];
    expect(emitted).toMatchObject({
      courier_id: 'courier-1',
      latitude: 4.710989,
      longitude: -74.072092,
      accuracy: 10,
      timestamp: expect.any(String),
    });
  });

  it('accuracy es opcional en el payload emitido', () => {
    const { gateway, roomEmit } = makeRealGateway();
    const payloadSinAccuracy: LocationPayload = { ...payload, accuracy: undefined };

    gateway.emitLocation('co-1', payloadSinAccuracy);

    const [, emitted] = roomEmit.mock.calls[0];
    expect(emitted.accuracy).toBeUndefined();
  });
});

// ─── PBT: handleConnection — roles no autorizados siempre desconectan ─────────

describe('P-5: roles no autorizados siempre desconectan (PBT)', () => {
  it('P-5: cualquier rol distinto de ADMIN/AUX → siempre desconecta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('COURIER', 'SUPER_ADMIN', 'UNKNOWN', ''),
        async (role) => {
          const { gateway, jwtService } = makeRealGateway();
          jwtService.verify.mockReturnValue({ company_id: 'co-1', role });
          const client = makeClient({ authToken: 'token' });

          await gateway.handleConnection(client);

          expect(client.disconnect).toHaveBeenCalled();
          expect(client.join).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── PBT: emitLocation — sala siempre coincide con company_id ─────────────────

describe('P-6: emitLocation siempre emite en la sala del company_id (PBT)', () => {
  it('P-6: para cualquier company_id y payload, server.to recibe exactamente ese id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          courier_id: fc.uuid(),
          latitude: fc.float({ min: -90, max: 90, noNaN: true }),
          longitude: fc.float({ min: -180, max: 180, noNaN: true }),
          timestamp: fc.constant(new Date().toISOString()),
        }),
        (companyId, partialPayload) => {
          const { gateway, mockServer } = makeRealGateway();
          const fullPayload: LocationPayload = { ...partialPayload };

          gateway.emitLocation(companyId, fullPayload);

          expect(mockServer.to).toHaveBeenCalledWith(companyId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

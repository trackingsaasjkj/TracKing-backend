/**
 * Tests de Notifications — specs/notifications.spec.ts
 * Cubre: registro de token, envío a courier, broadcast, helpers de negocio
 */
import * as fc from 'fast-check';
import { NotificationsUseCases } from '../src/modules/notifications/application/use-cases/notifications.use-cases';
import { NotificationType } from '../src/modules/notifications/application/dto/send-notification.dto';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeRepo() {
  return {
    upsertFcmToken: jest.fn().mockResolvedValue(undefined),
    getFcmTokenByCourierId: jest.fn(),
    getAllActiveFcmTokens: jest.fn(),
    clearFcmToken: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeFirebase(configured = true) {
  return {
    isConfigured: configured,
    sendToDevice: jest.fn().mockResolvedValue(true),
    sendToMultipleDevices: jest.fn().mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      invalidTokens: [],
    }),
  } as any;
}

// ─── registerToken ────────────────────────────────────────────────────────────

describe('NotificationsUseCases.registerToken', () => {
  it('llama a upsertFcmToken con los parámetros correctos', async () => {
    const repo = makeRepo();
    const firebase = makeFirebase();
    const useCases = new NotificationsUseCases(repo, firebase);

    await useCases.registerToken({ token: 'fcm-token-123' }, 'user-1', 'company-1');

    expect(repo.upsertFcmToken).toHaveBeenCalledWith('user-1', 'company-1', 'fcm-token-123');
  });

  it('PBT: siempre llama upsertFcmToken con cualquier token válido', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.uuid(),
        fc.uuid(),
        async (token, userId, companyId) => {
          const repo = makeRepo();
          const firebase = makeFirebase();
          const useCases = new NotificationsUseCases(repo, firebase);

          await useCases.registerToken({ token }, userId, companyId);

          expect(repo.upsertFcmToken).toHaveBeenCalledWith(userId, companyId, token);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── clearToken ───────────────────────────────────────────────────────────────

describe('NotificationsUseCases.clearToken', () => {
  it('llama a clearFcmToken con userId y companyId', async () => {
    const repo = makeRepo();
    const useCases = new NotificationsUseCases(repo, makeFirebase());

    await useCases.clearToken('user-1', 'company-1');

    expect(repo.clearFcmToken).toHaveBeenCalledWith('user-1', 'company-1');
  });
});

// ─── sendToCourier ────────────────────────────────────────────────────────────

describe('NotificationsUseCases.sendToCourier', () => {
  const dto = {
    courierId: 'courier-1',
    title: 'Test',
    body: 'Mensaje de prueba',
    type: NotificationType.NEW_SERVICE,
    data: { serviceId: 'svc-1' },
  };

  it('retorna { sent: false } si el mensajero no tiene token', async () => {
    const repo = makeRepo();
    repo.getFcmTokenByCourierId.mockResolvedValue(null);
    const useCases = new NotificationsUseCases(repo, makeFirebase());

    const result = await useCases.sendToCourier(dto, 'company-1');

    expect(result).toEqual({ sent: false });
    expect(makeFirebase().sendToDevice).not.toHaveBeenCalled();
  });

  it('envía notificación y retorna { sent: true } cuando hay token', async () => {
    const repo = makeRepo();
    repo.getFcmTokenByCourierId.mockResolvedValue('valid-fcm-token');
    const firebase = makeFirebase();
    const useCases = new NotificationsUseCases(repo, firebase);

    const result = await useCases.sendToCourier(dto, 'company-1');

    expect(firebase.sendToDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'valid-fcm-token',
        title: 'Test',
        body: 'Mensaje de prueba',
        data: expect.objectContaining({ type: NotificationType.NEW_SERVICE, serviceId: 'svc-1' }),
      }),
    );
    expect(result).toEqual({ sent: true });
  });

  it('retorna { sent: false } si Firebase falla', async () => {
    const repo = makeRepo();
    repo.getFcmTokenByCourierId.mockResolvedValue('valid-fcm-token');
    const firebase = makeFirebase();
    firebase.sendToDevice.mockResolvedValue(false);
    const useCases = new NotificationsUseCases(repo, firebase);

    const result = await useCases.sendToCourier(dto, 'company-1');

    expect(result).toEqual({ sent: false });
  });
});

// ─── sendToAllCouriers ────────────────────────────────────────────────────────

describe('NotificationsUseCases.sendToAllCouriers', () => {
  it('retorna 0/0 si no hay mensajeros con token', async () => {
    const repo = makeRepo();
    repo.getAllActiveFcmTokens.mockResolvedValue([]);
    const useCases = new NotificationsUseCases(repo, makeFirebase());

    const result = await useCases.sendToAllCouriers('company-1', 'Título', 'Cuerpo');

    expect(result).toEqual({ successCount: 0, failureCount: 0 });
  });

  it('llama a sendToMultipleDevices con los tokens correctos', async () => {
    const repo = makeRepo();
    repo.getAllActiveFcmTokens.mockResolvedValue(['token-a', 'token-b']);
    const firebase = makeFirebase();
    const useCases = new NotificationsUseCases(repo, firebase);

    const result = await useCases.sendToAllCouriers('company-1', 'Título', 'Cuerpo');

    expect(firebase.sendToMultipleDevices).toHaveBeenCalledWith(
      ['token-a', 'token-b'],
      'Título',
      'Cuerpo',
      undefined,
    );
    expect(result).toEqual({ successCount: 2, failureCount: 0 });
  });
});

// ─── Helpers de negocio ───────────────────────────────────────────────────────

describe('NotificationsUseCases — helpers de negocio', () => {
  let repo: ReturnType<typeof makeRepo>;
  let firebase: ReturnType<typeof makeFirebase>;
  let useCases: NotificationsUseCases;

  beforeEach(() => {
    repo = makeRepo();
    repo.getFcmTokenByCourierId.mockResolvedValue('token-xyz');
    firebase = makeFirebase();
    useCases = new NotificationsUseCases(repo, firebase);
  });

  it('notifyNewService envía con tipo NEW_SERVICE y serviceId', async () => {
    await useCases.notifyNewService('courier-1', 'svc-1', 'company-1');

    expect(firebase.sendToDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: NotificationType.NEW_SERVICE, serviceId: 'svc-1' }),
      }),
    );
  });

  it('notifyServiceUpdate envía con tipo SERVICE_UPDATE', async () => {
    await useCases.notifyServiceUpdate('courier-1', 'svc-1', 'company-1', 'Servicio cancelado');

    expect(firebase.sendToDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Servicio cancelado',
        data: expect.objectContaining({ type: NotificationType.SERVICE_UPDATE }),
      }),
    );
  });

  it('notifySettlementReady envía con tipo SETTLEMENT_READY', async () => {
    await useCases.notifySettlementReady('courier-1', 'company-1');

    expect(firebase.sendToDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: NotificationType.SETTLEMENT_READY }),
      }),
    );
  });
});

// ─── PBT: tipo de notificación siempre se incluye en data ────────────────────

describe('PBT: tipo de notificación siempre presente en data enviada a FCM', () => {
  it('cualquier NotificationType válido se incluye en data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...Object.values(NotificationType)),
        async (type) => {
          const repo = makeRepo();
          repo.getFcmTokenByCourierId.mockResolvedValue('token-test');
          const firebase = makeFirebase();
          const useCases = new NotificationsUseCases(repo, firebase);

          await useCases.sendToCourier(
            { courierId: 'c-1', title: 'T', body: 'B', type },
            'company-1',
          );

          const call = firebase.sendToDevice.mock.calls[0][0];
          expect(call.data.type).toBe(type);
        },
      ),
      { numRuns: 20 },
    );
  });
});

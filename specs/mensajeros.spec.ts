/**
 * Tests de Mensajeros — specs/mensajeros.spec.ts
 * Requirements: 3.1, 3.2, 3.3
 */
import * as fc from 'fast-check';

import { JornadaUseCase } from '../src/modules/mensajeros/application/use-cases/jornada.use-case';
import { MensajeroStateMachine } from '../src/modules/mensajeros/domain/mensajero.machine';
import { AppException } from '../src/core/errors/app.exception';

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeMensajeroRepo() {
  return {
    findById: jest.fn(),
    updateStatus: jest.fn(),
    countActiveServices: jest.fn(),
  } as any;
}

function makeMensajero(operational_status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'courier-1',
    company_id: 'co-1',
    operational_status,
    user: { id: 'user-1', name: 'Test', email: 'test@test.com', status: 'ACTIVE' },
    ...overrides,
  };
}

// ─── JornadaUseCase.iniciar ───────────────────────────────────────────────────

describe('JornadaUseCase.iniciar', () => {
  let useCase: JornadaUseCase;
  let repo: ReturnType<typeof makeMensajeroRepo>;

  beforeEach(() => {
    repo = makeMensajeroRepo();
    useCase = new JornadaUseCase(repo);
  });

  // 6.3 Unit test: iniciar desde UNAVAILABLE → AVAILABLE
  it('iniciar desde UNAVAILABLE → AVAILABLE (OK)', async () => {
    const mensajero = makeMensajero('UNAVAILABLE');
    const updated = makeMensajero('AVAILABLE');

    repo.findById.mockResolvedValueOnce(mensajero).mockResolvedValueOnce(updated);
    repo.updateStatus.mockResolvedValue(undefined);

    const result = await useCase.iniciar('courier-1', 'co-1');

    expect(repo.updateStatus).toHaveBeenCalledWith('courier-1', 'co-1', 'AVAILABLE');
    expect(result!.operational_status).toBe('AVAILABLE');
  });

  // 6.4 Unit test: iniciar desde AVAILABLE → error (AppException)
  it('iniciar desde AVAILABLE → AppException', async () => {
    const mensajero = makeMensajero('AVAILABLE');
    repo.findById.mockResolvedValue(mensajero);

    await expect(useCase.iniciar('courier-1', 'co-1')).rejects.toThrow(AppException);
  });

  it('iniciar desde IN_SERVICE → AppException', async () => {
    const mensajero = makeMensajero('IN_SERVICE');
    repo.findById.mockResolvedValue(mensajero);

    await expect(useCase.iniciar('courier-1', 'co-1')).rejects.toThrow(AppException);
  });
});

// ─── JornadaUseCase.finalizar ─────────────────────────────────────────────────

describe('JornadaUseCase.finalizar', () => {
  let useCase: JornadaUseCase;
  let repo: ReturnType<typeof makeMensajeroRepo>;

  beforeEach(() => {
    repo = makeMensajeroRepo();
    useCase = new JornadaUseCase(repo);
  });

  // 6.5 Unit test: finalizar desde AVAILABLE sin servicios activos → UNAVAILABLE
  it('finalizar desde AVAILABLE sin servicios activos → UNAVAILABLE (OK)', async () => {
    const mensajero = makeMensajero('AVAILABLE');
    const updated = makeMensajero('UNAVAILABLE');

    repo.findById.mockResolvedValueOnce(mensajero).mockResolvedValueOnce(updated);
    repo.countActiveServices.mockResolvedValue(0);
    repo.updateStatus.mockResolvedValue(undefined);

    const result = await useCase.finalizar('courier-1', 'co-1');

    expect(repo.updateStatus).toHaveBeenCalledWith('courier-1', 'co-1', 'UNAVAILABLE');
    expect(result!.operational_status).toBe('UNAVAILABLE');
  });

  // 6.6 Unit test: finalizar con servicios ASSIGNED/ACCEPTED/IN_TRANSIT → error
  it('finalizar con servicios activos → AppException', async () => {
    const mensajero = makeMensajero('AVAILABLE');
    repo.findById.mockResolvedValue(mensajero);
    repo.countActiveServices.mockResolvedValue(2);

    await expect(useCase.finalizar('courier-1', 'co-1')).rejects.toThrow(AppException);
  });

  // 6.7 Unit test: finalizar desde IN_SERVICE → error
  it('finalizar desde IN_SERVICE → AppException', async () => {
    const mensajero = makeMensajero('IN_SERVICE');
    repo.findById.mockResolvedValue(mensajero);
    repo.countActiveServices.mockResolvedValue(0);

    await expect(useCase.finalizar('courier-1', 'co-1')).rejects.toThrow(AppException);
  });

  it('finalizar desde UNAVAILABLE → AppException', async () => {
    const mensajero = makeMensajero('UNAVAILABLE');
    repo.findById.mockResolvedValue(mensajero);
    repo.countActiveServices.mockResolvedValue(0);

    await expect(useCase.finalizar('courier-1', 'co-1')).rejects.toThrow(AppException);
  });
});

// ─── PBT: asignación siempre falla para estados no AVAILABLE ─────────────────

describe('P-3: estados no elegibles para recibir servicios (PBT)', () => {
  // 6.8 PBT: fc.constantFrom('UNAVAILABLE', 'IN_SERVICE') → asignación siempre falla
  // Validates: Requirements 3.1, 3.2
  it('P-3: UNAVAILABLE e IN_SERVICE → canReceiveServices siempre retorna false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('UNAVAILABLE' as const, 'IN_SERVICE' as const),
        (estado) => {
          expect(MensajeroStateMachine.canReceiveServices(estado)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P-3b: AVAILABLE → canReceiveServices siempre retorna true', () => {
    fc.assert(
      fc.property(
        fc.constant('AVAILABLE' as const),
        (estado) => {
          expect(MensajeroStateMachine.canReceiveServices(estado)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

import { CambiarEstadoUseCase } from '../../../modules/servicios/application/use-cases/cambiar-estado.use-case';
import { AppException } from '../../../core/errors/app.exception';
import { NotFoundException } from '@nestjs/common';
import { CacheService } from '../../../infrastructure/cache/cache.service';

const makeCache = () => ({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
  delete: jest.fn(),
  deleteByPrefix: jest.fn(),
  size: jest.fn(),
} as unknown as CacheService);

const makeService = (status: string, courier_id = 'courier-1') => ({
  id: 'svc-1', company_id: 'co-1', status, courier_id,
});

const mockServicioRepo = { findById: jest.fn(), update: jest.fn() };
const mockHistorialRepo = { create: jest.fn() };
const mockEvidenceRepo = { findByServiceId: jest.fn() };
const mockCourierRepo = { updateStatus: jest.fn() };
const mockGateway = { emitServiceUpdate: jest.fn(), emitServiceAssigned: jest.fn() };
const mockNotifications = { notifyServiceStatusChange: jest.fn().mockResolvedValue(undefined) };

describe('CambiarEstadoUseCase', () => {
  let useCase: CambiarEstadoUseCase;

  beforeEach(() => {
    useCase = new CambiarEstadoUseCase(
      mockServicioRepo as any,
      mockHistorialRepo as any,
      mockEvidenceRepo as any,
      mockCourierRepo as any,
      makeCache(),
      mockGateway as any,
      mockNotifications as any,
    );
    jest.clearAllMocks();
    mockServicioRepo.update.mockResolvedValue({});
    mockHistorialRepo.create.mockResolvedValue({});
    mockCourierRepo.updateStatus.mockResolvedValue({});
  });

  it('transitions ASSIGNED → ACCEPTED', async () => {
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('ASSIGNED'))
      .mockResolvedValueOnce(makeService('ACCEPTED'));
    await useCase.execute('svc-1', { status: 'ACCEPTED' }, 'co-1', 'user-1');
    expect(mockServicioRepo.update).toHaveBeenCalledWith('svc-1', 'co-1', { status: 'ACCEPTED' });
  });

  it('throws on invalid transition PENDING → DELIVERED', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('PENDING'));
    await expect(useCase.execute('svc-1', { status: 'DELIVERED' }, 'co-1', 'user-1')).rejects.toThrow(AppException);
  });

  it('throws DELIVERED without evidence', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('IN_TRANSIT'));
    mockEvidenceRepo.findByServiceId.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', { status: 'DELIVERED' }, 'co-1', 'user-1')).rejects.toThrow(AppException);
  });

  it('allows DELIVERED with evidence', async () => {
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('IN_TRANSIT'))
      .mockResolvedValueOnce(makeService('DELIVERED'));
    mockEvidenceRepo.findByServiceId.mockResolvedValue({ id: 'ev-1', image_url: 'http://img' });
    await useCase.execute('svc-1', { status: 'DELIVERED' }, 'co-1', 'user-1');
    expect(mockServicioRepo.update).toHaveBeenCalledWith('svc-1', 'co-1', expect.objectContaining({ status: 'DELIVERED' }));
  });

  it('throws when service not found', async () => {
    mockServicioRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', { status: 'ACCEPTED' }, 'co-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('frees courier on DELIVERED', async () => {
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('IN_TRANSIT', 'courier-1'))
      .mockResolvedValueOnce(makeService('DELIVERED', 'courier-1'));
    mockEvidenceRepo.findByServiceId.mockResolvedValue({ id: 'ev-1' });
    await useCase.execute('svc-1', { status: 'DELIVERED' }, 'co-1', 'user-1');
    expect(mockCourierRepo.updateStatus).toHaveBeenCalledWith('courier-1', 'co-1', 'AVAILABLE');
  });

  it('calls gateway.emitServiceUpdate after state change', async () => {
    const updated = makeService('ACCEPTED');
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('ASSIGNED'))
      .mockResolvedValueOnce(updated);
    await useCase.execute('svc-1', { status: 'ACCEPTED' }, 'co-1', 'user-1');
    expect(mockGateway.emitServiceUpdate).toHaveBeenCalledWith('courier-1', updated);
  });

  it('calls notifyServiceStatusChange fire-and-forget after state change', async () => {
    const updated = makeService('ACCEPTED');
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('ASSIGNED'))
      .mockResolvedValueOnce(updated);
    await useCase.execute('svc-1', { status: 'ACCEPTED' }, 'co-1', 'user-1');
    // fire-and-forget: called but not awaited — verify it was invoked
    expect(mockNotifications.notifyServiceStatusChange).toHaveBeenCalledWith('courier-1', 'co-1', updated);
  });

  it('works without gateway (optional dependency)', async () => {
    const useCaseNoGateway = new CambiarEstadoUseCase(
      mockServicioRepo as any,
      mockHistorialRepo as any,
      mockEvidenceRepo as any,
      mockCourierRepo as any,
      makeCache(),
      null as any,
      null as any,
    );
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('ASSIGNED'))
      .mockResolvedValueOnce(makeService('ACCEPTED'));
    await expect(
      useCaseNoGateway.execute('svc-1', { status: 'ACCEPTED' }, 'co-1', 'user-1'),
    ).resolves.not.toThrow();
  });
});

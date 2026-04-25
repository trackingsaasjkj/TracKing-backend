import { CancelarServicioUseCase } from '../../../modules/servicios/application/use-cases/cancelar-servicio.use-case';
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

const makeService = (status: string, courier_id: string | null = null) => ({
  id: 'svc-1', company_id: 'co-1', status, courier_id,
});

const mockServicioRepo = { findById: jest.fn(), update: jest.fn() };
const mockHistorialRepo = { create: jest.fn() };
const mockCourierRepo = { updateStatus: jest.fn(), countActiveServices: jest.fn() };

describe('CancelarServicioUseCase', () => {
  let useCase: CancelarServicioUseCase;

  beforeEach(() => {
    useCase = new CancelarServicioUseCase(
      mockServicioRepo as any,
      mockHistorialRepo as any,
      mockCourierRepo as any,
      makeCache(),
      { notifyServiceUpdate: jest.fn().mockResolvedValue(undefined) } as any,
    );
    jest.clearAllMocks();
    mockServicioRepo.update.mockResolvedValue({});
    mockServicioRepo.findById.mockResolvedValue(makeService('PENDING'));
    mockHistorialRepo.create.mockResolvedValue({});
    mockCourierRepo.updateStatus.mockResolvedValue({});
    mockCourierRepo.countActiveServices.mockResolvedValue(0);
  });

  it('cancels a PENDING service', async () => {
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('PENDING'))
      .mockResolvedValueOnce({ ...makeService('CANCELLED') });
    const result = await useCase.execute('svc-1', 'co-1', 'user-1');
    expect(mockServicioRepo.update).toHaveBeenCalledWith('svc-1', 'co-1', { status: 'CANCELLED' });
    expect(mockHistorialRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ new_status: 'CANCELLED', previous_status: 'PENDING' }),
    );
  });

  it('throws when service not found', async () => {
    mockServicioRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', 'co-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when service is IN_TRANSIT', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('IN_TRANSIT'));
    await expect(useCase.execute('svc-1', 'co-1', 'user-1')).rejects.toThrow(AppException);
  });

  it('throws when service is DELIVERED', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('DELIVERED'));
    await expect(useCase.execute('svc-1', 'co-1', 'user-1')).rejects.toThrow(AppException);
  });

  it('frees courier when cancelling an ASSIGNED service', async () => {
    mockServicioRepo.findById
      .mockResolvedValueOnce(makeService('ASSIGNED', 'courier-1'))
      .mockResolvedValueOnce(makeService('CANCELLED', 'courier-1'));
    await useCase.execute('svc-1', 'co-1', 'user-1');
    expect(mockCourierRepo.updateStatus).toHaveBeenCalledWith('courier-1', 'co-1', 'AVAILABLE');
  });
});

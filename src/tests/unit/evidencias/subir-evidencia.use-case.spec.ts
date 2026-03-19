import { SubirEvidenciaUseCase } from '../../../modules/evidencias/application/use-cases/subir-evidencia.use-case';
import { AppException } from '../../../core/errors/app.exception';
import { NotFoundException } from '@nestjs/common';

const makeService = (status: string) => ({
  id: 'svc-1', company_id: 'co-1', status, courier_id: 'c-1',
});

const mockEvidenciaRepo = { upsert: jest.fn() };
const mockServicioRepo = { findById: jest.fn() };

const dto = { image_url: 'https://cdn.example.com/photo.jpg' };

describe('SubirEvidenciaUseCase', () => {
  let useCase: SubirEvidenciaUseCase;

  beforeEach(() => {
    useCase = new SubirEvidenciaUseCase(mockEvidenciaRepo as any, mockServicioRepo as any);
    jest.clearAllMocks();
  });

  it('uploads evidence when service is IN_TRANSIT', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('IN_TRANSIT'));
    mockEvidenciaRepo.upsert.mockResolvedValue({ id: 'ev-1', image_url: dto.image_url });

    const result = await useCase.execute('svc-1', dto, 'co-1');

    expect(mockEvidenciaRepo.upsert).toHaveBeenCalledWith({
      company_id: 'co-1',
      service_id: 'svc-1',
      image_url: dto.image_url,
    });
    expect(result.image_url).toBe(dto.image_url);
  });

  it('throws NotFoundException when service not found', async () => {
    mockServicioRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', dto, 'co-1')).rejects.toThrow(NotFoundException);
  });

  it('throws AppException when service is PENDING', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('PENDING'));
    await expect(useCase.execute('svc-1', dto, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when service is DELIVERED', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('DELIVERED'));
    await expect(useCase.execute('svc-1', dto, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when service is CANCELLED', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('CANCELLED'));
    await expect(useCase.execute('svc-1', dto, 'co-1')).rejects.toThrow(AppException);
  });

  it('re-uploads (upsert) when evidence already exists', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('IN_TRANSIT'));
    const updated = { id: 'ev-1', image_url: 'https://cdn.example.com/new.jpg' };
    mockEvidenciaRepo.upsert.mockResolvedValue(updated);

    const result = await useCase.execute('svc-1', { image_url: 'https://cdn.example.com/new.jpg' }, 'co-1');
    expect(result.image_url).toBe('https://cdn.example.com/new.jpg');
  });
});

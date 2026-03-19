import { ConsultarEvidenciaUseCase } from '../../../modules/evidencias/application/use-cases/consultar-evidencia.use-case';
import { NotFoundException } from '@nestjs/common';

const makeService = () => ({ id: 'svc-1', company_id: 'co-1', status: 'DELIVERED' });
const makeEvidence = () => ({ id: 'ev-1', service_id: 'svc-1', image_url: 'https://cdn.example.com/photo.jpg' });

const mockEvidenciaRepo = { findByServiceId: jest.fn() };
const mockServicioRepo = { findById: jest.fn() };

describe('ConsultarEvidenciaUseCase', () => {
  let useCase: ConsultarEvidenciaUseCase;

  beforeEach(() => {
    useCase = new ConsultarEvidenciaUseCase(mockEvidenciaRepo as any, mockServicioRepo as any);
    jest.clearAllMocks();
  });

  it('returns evidence when it exists', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService());
    mockEvidenciaRepo.findByServiceId.mockResolvedValue(makeEvidence());

    const result = await useCase.execute('svc-1', 'co-1');
    expect(result.image_url).toBe('https://cdn.example.com/photo.jpg');
  });

  it('throws NotFoundException when service not found', async () => {
    mockServicioRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', 'co-1')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when no evidence registered', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService());
    mockEvidenciaRepo.findByServiceId.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', 'co-1')).rejects.toThrow(NotFoundException);
  });

  it('is scoped to company — does not expose cross-company evidence', async () => {
    // Service not found for a different company_id
    mockServicioRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', 'other-company')).rejects.toThrow(NotFoundException);
    expect(mockEvidenciaRepo.findByServiceId).not.toHaveBeenCalled();
  });
});

import { SubirEvidenciaUseCase } from '../../../modules/evidencias/application/use-cases/subir-evidencia.use-case';
import { AppException } from '../../../core/errors/app.exception';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const makeService = (status: string) => ({
  id: 'svc-1', company_id: 'co-1', status, courier_id: 'c-1',
});

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'foto.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image'),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

const IMAGE_URL = 'https://storage.supabase.co/evidencias/co-1/svc-1.jpg';

describe('SubirEvidenciaUseCase', () => {
  let useCase: SubirEvidenciaUseCase;
  let mockEvidenciaRepo: { upsert: jest.Mock };
  let mockServicioRepo: { findById: jest.Mock };
  let mockStorageService: { upload: jest.Mock };

  beforeEach(() => {
    mockEvidenciaRepo = { upsert: jest.fn() };
    mockServicioRepo = { findById: jest.fn() };
    mockStorageService = { upload: jest.fn() };
    useCase = new SubirEvidenciaUseCase(
      mockEvidenciaRepo as any,
      mockServicioRepo as any,
      mockStorageService as any,
    );
    jest.clearAllMocks();
  });

  it('uploads evidence when service is IN_TRANSIT', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('IN_TRANSIT'));
    mockStorageService.upload.mockResolvedValue(IMAGE_URL);
    mockEvidenciaRepo.upsert.mockResolvedValue({ id: 'ev-1', image_url: IMAGE_URL });

    const result = await useCase.execute('svc-1', makeFile(), 'co-1');

    expect(mockStorageService.upload).toHaveBeenCalled();
    expect(mockEvidenciaRepo.upsert).toHaveBeenCalledWith({
      company_id: 'co-1',
      service_id: 'svc-1',
      image_url: IMAGE_URL,
    });
    expect(result.image_url).toBe(IMAGE_URL);
  });

  it('throws NotFoundException when service not found', async () => {
    mockServicioRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('svc-1', makeFile(), 'co-1')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when no file provided', async () => {
    await expect(useCase.execute('svc-1', null as any, 'co-1')).rejects.toThrow(BadRequestException);
  });

  it('throws AppException when service is PENDING', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('PENDING'));
    await expect(useCase.execute('svc-1', makeFile(), 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when service is DELIVERED', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('DELIVERED'));
    await expect(useCase.execute('svc-1', makeFile(), 'co-1')).rejects.toThrow(AppException);
  });

  it('re-uploads (upsert) when evidence already exists', async () => {
    mockServicioRepo.findById.mockResolvedValue(makeService('IN_TRANSIT'));
    const newUrl = 'https://storage.supabase.co/evidencias/co-1/svc-1-new.jpg';
    mockStorageService.upload.mockResolvedValue(newUrl);
    mockEvidenciaRepo.upsert.mockResolvedValue({ id: 'ev-1', image_url: newUrl });

    const result = await useCase.execute('svc-1', makeFile({ originalname: 'new.jpg' }), 'co-1');
    expect(result.image_url).toBe(newUrl);
  });
});

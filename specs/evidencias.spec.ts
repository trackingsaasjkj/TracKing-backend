import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fc from 'fast-check';
import { SubirEvidenciaUseCase } from '../src/modules/evidencias/application/use-cases/subir-evidencia.use-case';
import { ConsultarEvidenciaUseCase } from '../src/modules/evidencias/application/use-cases/consultar-evidencia.use-case';
import { validarSubidaEvidencia } from '../src/modules/evidencias/domain/rules/validar-evidencia.rule';
import { AppException } from '../src/core/errors/app.exception';

// ─── helpers ────────────────────────────────────────────────────────────────

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

function makeServicio(status: string) {
  return { id: 'svc-1', status, company_id: 'co-1' };
}

function makeEvidencia() {
  return {
    id: 'ev-1',
    service_id: 'svc-1',
    company_id: 'co-1',
    image_url: 'https://storage.supabase.co/evidencias/co-1/svc-1.jpg',
    registration_date: new Date(),
  };
}

// ─── SubirEvidenciaUseCase ───────────────────────────────────────────────────

describe('SubirEvidenciaUseCase', () => {
  let useCase: SubirEvidenciaUseCase;
  let evidenciaRepo: { upsert: jest.Mock };
  let servicioRepo: { findById: jest.Mock };
  let storageService: { upload: jest.Mock };

  const COMPANY_ID = 'co-1';
  const SERVICE_ID = 'svc-1';
  const IMAGE_URL = 'https://storage.supabase.co/evidencias/co-1/svc-1.jpg';

  beforeEach(() => {
    evidenciaRepo = { upsert: jest.fn() };
    servicioRepo = { findById: jest.fn() };
    storageService = { upload: jest.fn() };
    useCase = new SubirEvidenciaUseCase(
      evidenciaRepo as any,
      servicioRepo as any,
      storageService as any,
    );
  });

  it('sube evidencia correctamente cuando servicio está IN_TRANSIT', async () => {
    servicioRepo.findById.mockResolvedValue(makeServicio('IN_TRANSIT'));
    storageService.upload.mockResolvedValue(IMAGE_URL);
    evidenciaRepo.upsert.mockResolvedValue(makeEvidencia());

    const result = await useCase.execute(SERVICE_ID, makeFile(), COMPANY_ID);

    expect(storageService.upload).toHaveBeenCalledWith(expect.any(Object), COMPANY_ID, SERVICE_ID);
    expect(evidenciaRepo.upsert).toHaveBeenCalledWith({ company_id: COMPANY_ID, service_id: SERVICE_ID, image_url: IMAGE_URL });
    expect(result).toMatchObject({ service_id: SERVICE_ID });
  });

  it('lanza NotFoundException si el servicio no existe', async () => {
    servicioRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(SERVICE_ID, makeFile(), COMPANY_ID)).rejects.toThrow(NotFoundException);
  });

  it('lanza BadRequestException si no se envía archivo', async () => {
    await expect(useCase.execute(SERVICE_ID, null as any, COMPANY_ID)).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException si el mimetype no está permitido', async () => {
    const file = makeFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' });
    await expect(useCase.execute(SERVICE_ID, file, COMPANY_ID)).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException si el archivo supera 5 MB', async () => {
    const file = makeFile({ size: 6 * 1024 * 1024 });
    await expect(useCase.execute(SERVICE_ID, file, COMPANY_ID)).rejects.toThrow(BadRequestException);
  });

  it('lanza AppException si el servicio no está IN_TRANSIT', async () => {
    servicioRepo.findById.mockResolvedValue(makeServicio('PENDING'));

    await expect(useCase.execute(SERVICE_ID, makeFile(), COMPANY_ID)).rejects.toThrow(AppException);
  });

  it('P: cualquier estado distinto a IN_TRANSIT lanza AppException', () => {
    const otrosEstados = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'DELIVERED', 'CANCELLED'];
    fc.assert(
      fc.property(fc.constantFrom(...otrosEstados), (estado) => {
        expect(() => validarSubidaEvidencia(estado as any)).toThrow(AppException);
      }),
    );
  });

  it('P: mimetypes no permitidos siempre lanzan BadRequestException', async () => {
    const mimesForbidden = ['application/pdf', 'text/plain', 'video/mp4', 'image/gif'];
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...mimesForbidden), async (mime) => {
        const file = makeFile({ mimetype: mime });
        await expect(useCase.execute(SERVICE_ID, file, COMPANY_ID)).rejects.toThrow(BadRequestException);
      }),
    );
  });
});

// ─── ConsultarEvidenciaUseCase ───────────────────────────────────────────────

describe('ConsultarEvidenciaUseCase', () => {
  let useCase: ConsultarEvidenciaUseCase;
  let evidenciaRepo: { findByServiceId: jest.Mock };
  let servicioRepo: { findById: jest.Mock };
  let storageService: { getSignedUrl: jest.Mock; getBucketName: jest.Mock };

  const COMPANY_ID = 'co-1';
  const SERVICE_ID = 'svc-1';

  beforeEach(() => {
    evidenciaRepo = { findByServiceId: jest.fn() };
    servicioRepo = { findById: jest.fn() };
    storageService = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/photo.jpg'), getBucketName: jest.fn().mockReturnValue('Evidencias') };
    useCase = new ConsultarEvidenciaUseCase(evidenciaRepo as any, servicioRepo as any, storageService as any);
  });

  it('retorna la evidencia cuando existe', async () => {
    servicioRepo.findById.mockResolvedValue(makeServicio('DELIVERED'));
    evidenciaRepo.findByServiceId.mockResolvedValue(makeEvidencia());

    const result = await useCase.execute(SERVICE_ID, COMPANY_ID);

    expect(result).toMatchObject({ service_id: SERVICE_ID, image_url: expect.stringContaining('http') });
  });

  it('lanza NotFoundException si el servicio no pertenece al tenant', async () => {
    servicioRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(SERVICE_ID, COMPANY_ID)).rejects.toThrow(NotFoundException);
  });

  it('lanza NotFoundException si no hay evidencia registrada', async () => {
    servicioRepo.findById.mockResolvedValue(makeServicio('IN_TRANSIT'));
    evidenciaRepo.findByServiceId.mockResolvedValue(null);

    await expect(useCase.execute(SERVICE_ID, COMPANY_ID)).rejects.toThrow(NotFoundException);
  });
});

// ─── validarSubidaEvidencia (domain rule) ───────────────────────────────────

describe('validarSubidaEvidencia', () => {
  it('no lanza cuando estado es IN_TRANSIT', () => {
    expect(() => validarSubidaEvidencia('IN_TRANSIT')).not.toThrow();
  });

  it('lanza AppException cuando estado es PENDING', () => {
    expect(() => validarSubidaEvidencia('PENDING')).toThrow(AppException);
  });

  it('lanza AppException cuando estado es DELIVERED', () => {
    expect(() => validarSubidaEvidencia('DELIVERED')).toThrow(AppException);
  });
});

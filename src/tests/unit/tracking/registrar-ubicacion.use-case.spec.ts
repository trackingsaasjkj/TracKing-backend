import { RegistrarUbicacionUseCase } from '../../../modules/tracking/application/use-cases/registrar-ubicacion.use-case';
import { AppException } from '../../../core/errors/app.exception';
import { NotFoundException } from '@nestjs/common';

const makeCourier = (status: string) => ({
  id: 'c-1', company_id: 'co-1', operational_status: status,
});

const dto = { latitude: 4.710989, longitude: -74.072092, accuracy: 10.5 };

const mockLocationRepo = { create: jest.fn() };
const mockMensajeroRepo = { findById: jest.fn() };

describe('RegistrarUbicacionUseCase', () => {
  let useCase: RegistrarUbicacionUseCase;

  beforeEach(() => {
    useCase = new RegistrarUbicacionUseCase(mockLocationRepo as any, mockMensajeroRepo as any);
    jest.clearAllMocks();
  });

  it('saves location when courier is IN_SERVICE', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier('IN_SERVICE'));
    mockLocationRepo.create.mockResolvedValue({ id: 'loc-1', ...dto });

    const result = await useCase.execute(dto, 'c-1', 'co-1');

    expect(mockLocationRepo.create).toHaveBeenCalledWith({
      company_id: 'co-1',
      courier_id: 'c-1',
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
    });
    expect(result.latitude).toBe(dto.latitude);
  });

  it('throws NotFoundException when courier not found', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(dto, 'c-1', 'co-1')).rejects.toThrow(NotFoundException);
    expect(mockLocationRepo.create).not.toHaveBeenCalled();
  });

  it('throws AppException when courier is AVAILABLE (not on a service)', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier('AVAILABLE'));
    await expect(useCase.execute(dto, 'c-1', 'co-1')).rejects.toThrow(AppException);
    expect(mockLocationRepo.create).not.toHaveBeenCalled();
  });

  it('throws AppException when courier is UNAVAILABLE', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier('UNAVAILABLE'));
    await expect(useCase.execute(dto, 'c-1', 'co-1')).rejects.toThrow(AppException);
    expect(mockLocationRepo.create).not.toHaveBeenCalled();
  });

  it('saves location without optional accuracy field', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier('IN_SERVICE'));
    mockLocationRepo.create.mockResolvedValue({ id: 'loc-2', latitude: 4.71, longitude: -74.07 });

    await useCase.execute({ latitude: 4.71, longitude: -74.07 }, 'c-1', 'co-1');

    expect(mockLocationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: undefined }),
    );
  });
});

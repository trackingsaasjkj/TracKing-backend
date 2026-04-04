import { GenerarLiquidacionCourierUseCase } from '../../../modules/liquidaciones/application/use-cases/generar-liquidacion-courier.use-case';
import { AppException } from '../../../core/errors/app.exception';
import { NotFoundException } from '@nestjs/common';

const makeCourier = () => ({ id: 'c-1', company_id: 'co-1' });
const makeRule = (type: string, value: number) => ({ type, value, active: true });
const makeServices = (count: number, delivery_price = 10000) =>
  Array.from({ length: count }, (_, i) => ({ id: `s-${i}`, delivery_price, product_price: 5000, total_price: 15000, delivery_date: new Date() }));

const mockLiquidacionRepo = {
  findActiveRule: jest.fn(),
  findDeliveredServices: jest.fn(),
  createCourierSettlement: jest.fn(),
  markServicesAsSettled: jest.fn().mockResolvedValue(undefined),
};
const mockMensajeroRepo = { findById: jest.fn() };

const dto = { courier_id: 'c-1', start_date: '2025-01-01', end_date: '2025-01-31' };

describe('GenerarLiquidacionCourierUseCase', () => {
  let useCase: GenerarLiquidacionCourierUseCase;

  beforeEach(() => {
    useCase = new GenerarLiquidacionCourierUseCase(mockLiquidacionRepo as any, mockMensajeroRepo as any);
    jest.clearAllMocks();
    mockLiquidacionRepo.createCourierSettlement.mockResolvedValue({ id: 'liq-1' });
  });

  it('generates settlement with PERCENTAGE rule', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
    mockLiquidacionRepo.findActiveRule.mockResolvedValue(makeRule('PERCENTAGE', 15));
    mockLiquidacionRepo.findDeliveredServices.mockResolvedValue(makeServices(3, 10000));

    await useCase.execute(dto, 'co-1');

    expect(mockLiquidacionRepo.createCourierSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ total_services: 3, total_earned: 4500 }),
    );
  });

  it('generates settlement with FIXED rule', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
    mockLiquidacionRepo.findActiveRule.mockResolvedValue(makeRule('FIXED', 3000));
    mockLiquidacionRepo.findDeliveredServices.mockResolvedValue(makeServices(2));

    await useCase.execute(dto, 'co-1');

    expect(mockLiquidacionRepo.createCourierSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ total_services: 2, total_earned: 6000 }),
    );
  });

  it('throws NotFoundException when courier not found', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(dto, 'co-1')).rejects.toThrow(NotFoundException);
  });

  it('throws AppException when no active rule', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
    mockLiquidacionRepo.findActiveRule.mockResolvedValue(null);
    await expect(useCase.execute(dto, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when no delivered services in range', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
    mockLiquidacionRepo.findActiveRule.mockResolvedValue(makeRule('FIXED', 3000));
    mockLiquidacionRepo.findDeliveredServices.mockResolvedValue([]);
    await expect(useCase.execute(dto, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when date range is invalid', async () => {
    mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
    const badDto = { ...dto, start_date: '2025-02-01', end_date: '2025-01-01' };
    await expect(useCase.execute(badDto, 'co-1')).rejects.toThrow(AppException);
  });
});

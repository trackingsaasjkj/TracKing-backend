import { GenerarLiquidacionClienteUseCase } from '../../../modules/liquidaciones/application/use-cases/generar-liquidacion-cliente.use-case';
import { AppException } from '../../../core/errors/app.exception';

const makeServices = (count: number, total_price = 15000) =>
  Array.from({ length: count }, (_, i) => ({
    id: `s-${i}`,
    delivery_price: 10000,
    product_price: 5000,
    total_price,
    delivery_date: new Date(),
  }));

const mockLiquidacionRepo = {
  findDeliveredServicesAllCouriers: jest.fn(),
  createCustomerSettlement: jest.fn(),
};

const dto = { start_date: '2025-01-01', end_date: '2025-01-31' };

describe('GenerarLiquidacionClienteUseCase', () => {
  let useCase: GenerarLiquidacionClienteUseCase;

  beforeEach(() => {
    useCase = new GenerarLiquidacionClienteUseCase(mockLiquidacionRepo as any);
    jest.clearAllMocks();
    mockLiquidacionRepo.createCustomerSettlement.mockResolvedValue({ id: 'cs-1' });
  });

  it('generates customer settlement summing total_price', async () => {
    mockLiquidacionRepo.findDeliveredServicesAllCouriers.mockResolvedValue(makeServices(3, 15000));

    await useCase.execute(dto, 'co-1');

    expect(mockLiquidacionRepo.createCustomerSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ total_services: 3, total_invoiced: 45000 }),
    );
  });

  it('throws AppException when no delivered services in range', async () => {
    mockLiquidacionRepo.findDeliveredServicesAllCouriers.mockResolvedValue([]);
    await expect(useCase.execute(dto, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when date range is invalid', async () => {
    const badDto = { start_date: '2025-02-01', end_date: '2025-01-01' };
    await expect(useCase.execute(badDto, 'co-1')).rejects.toThrow(AppException);
  });

  it('scopes query to company_id', async () => {
    mockLiquidacionRepo.findDeliveredServicesAllCouriers.mockResolvedValue(makeServices(1));
    await useCase.execute(dto, 'co-1');
    expect(mockLiquidacionRepo.findDeliveredServicesAllCouriers).toHaveBeenCalledWith(
      'co-1',
      expect.any(Date),
      expect.any(Date),
    );
  });
});

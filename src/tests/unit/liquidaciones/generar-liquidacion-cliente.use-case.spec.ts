import { GenerarLiquidacionClienteUseCase } from '../../../modules/liquidaciones/application/use-cases/generar-liquidacion-cliente.use-case';
import { AppException } from '../../../core/errors/app.exception';

const makeServices = (count: number, delivery_price = 10000) =>
  Array.from({ length: count }, (_, i) => ({
    id: `s-${i}`,
    delivery_price,
    delivery_date: new Date(),
  }));

const mockLiquidacionRepo = {
  findCustomerById: jest.fn(),
  findDeliveredServicesByCustomer: jest.fn(),
  createCustomerSettlement: jest.fn(),
};

const dto = { customer_id: 'cust-1', start_date: '2025-01-01', end_date: '2025-01-31' };

describe('GenerarLiquidacionClienteUseCase', () => {
  let useCase: GenerarLiquidacionClienteUseCase;

  beforeEach(() => {
    useCase = new GenerarLiquidacionClienteUseCase(mockLiquidacionRepo as any);
    jest.clearAllMocks();
    mockLiquidacionRepo.findCustomerById.mockResolvedValue({ id: 'cust-1', name: 'Test' });
    mockLiquidacionRepo.createCustomerSettlement.mockResolvedValue({ id: 'cs-1' });
  });

  it('generates customer settlement summing delivery_price', async () => {
    mockLiquidacionRepo.findDeliveredServicesByCustomer.mockResolvedValue(makeServices(3, 10000));

    await useCase.execute(dto, 'co-1');

    expect(mockLiquidacionRepo.createCustomerSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 'cust-1', total_services: 3, total_invoiced: 30000 }),
    );
  });

  it('throws AppException when no delivered services in range', async () => {
    mockLiquidacionRepo.findDeliveredServicesByCustomer.mockResolvedValue([]);
    await expect(useCase.execute(dto, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when date range is invalid', async () => {
    const badDto = { customer_id: 'cust-1', start_date: '2025-02-01', end_date: '2025-01-01' };
    await expect(useCase.execute(badDto, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws NotFoundException when customer not found', async () => {
    mockLiquidacionRepo.findCustomerById.mockResolvedValue(null);
    await expect(useCase.execute(dto, 'co-1')).rejects.toThrow('Cliente no encontrado');
  });

  it('scopes query to company_id and customer_id', async () => {
    mockLiquidacionRepo.findDeliveredServicesByCustomer.mockResolvedValue(makeServices(1));
    await useCase.execute(dto, 'co-1');
    expect(mockLiquidacionRepo.findDeliveredServicesByCustomer).toHaveBeenCalledWith(
      'co-1',
      'cust-1',
      expect.any(Date),
      expect.any(Date),
    );
  });
});

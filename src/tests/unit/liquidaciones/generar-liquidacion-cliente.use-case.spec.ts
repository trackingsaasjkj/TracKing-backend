import { GenerarLiquidacionClienteUseCase } from '../../../modules/liquidaciones/application/use-cases/generar-liquidacion-cliente.use-case';
import { AppException } from '../../../core/errors/app.exception';

const makeServices = (count: number, delivery_price = 10000, payment_status = 'UNPAID') =>
  Array.from({ length: count }, (_, i) => ({
    id: `s-${i}`,
    customer_id: 'cust-1',
    delivery_price,
    payment_status,
    is_settled_customer: false,
  }));

const mockLiquidacionRepo = {
  findServicesByIds: jest.fn(),
  createCustomerSettlement: jest.fn(),
  markServicesAsPaid: jest.fn().mockResolvedValue(undefined),
};

const dto = { service_ids: ['s-0', 's-1', 's-2'] };

describe('GenerarLiquidacionClienteUseCase', () => {
  let useCase: GenerarLiquidacionClienteUseCase;

  beforeEach(() => {
    useCase = new GenerarLiquidacionClienteUseCase(mockLiquidacionRepo as any);
    jest.clearAllMocks();
    mockLiquidacionRepo.createCustomerSettlement.mockResolvedValue({
      id: 'cs-1',
      total_invoiced: 30000,
    });
  });

  it('generates customer settlement summing UNPAID delivery_price', async () => {
    mockLiquidacionRepo.findServicesByIds.mockResolvedValue(makeServices(3, 10000));

    await useCase.execute(dto as any, 'co-1');

    expect(mockLiquidacionRepo.createCustomerSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 'cust-1', total_services: 3, total_invoiced: 30000 }),
    );
  });

  it('throws AppException when service_ids is empty', async () => {
    await expect(
      useCase.execute({ service_ids: [] } as any, 'co-1'),
    ).rejects.toThrow(AppException);
  });

  it('throws AppException when services do not belong to company', async () => {
    // Returns fewer services than requested → some don't belong
    mockLiquidacionRepo.findServicesByIds.mockResolvedValue(makeServices(1, 10000));
    await expect(
      useCase.execute({ service_ids: ['s-0', 's-1'] } as any, 'co-1'),
    ).rejects.toThrow(AppException);
  });

  it('throws AppException when services are already settled', async () => {
    mockLiquidacionRepo.findServicesByIds.mockResolvedValue(
      makeServices(2, 10000, 'UNPAID').map(s => ({ ...s, is_settled_customer: true })),
    );
    await expect(
      useCase.execute({ service_ids: ['s-0', 's-1'] } as any, 'co-1'),
    ).rejects.toThrow(AppException);
  });

  it('marks services as paid after settlement', async () => {
    mockLiquidacionRepo.findServicesByIds.mockResolvedValue(makeServices(2, 10000));
    await useCase.execute({ service_ids: ['s-0', 's-1'] } as any, 'co-1');
    expect(mockLiquidacionRepo.markServicesAsPaid).toHaveBeenCalledWith(
      ['s-0', 's-1'],
      'co-1',
    );
  });
});

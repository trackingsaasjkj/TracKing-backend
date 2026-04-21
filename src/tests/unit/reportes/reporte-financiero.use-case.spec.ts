import { ReporteFinancieroUseCase } from '../../../modules/reportes/application/use-cases/reporte-financiero.use-case';
import { AppException } from '../../../core/errors/app.exception';

const mockRepo = {
  totalRevenue: jest.fn(),
  revenueByPaymentMethod: jest.fn(),
  settlementSummary: jest.fn(),
};

const mockCache = { get: jest.fn().mockReturnValue(null), set: jest.fn() };

const dto = { from: '2025-01-01', to: '2025-01-31' };

describe('ReporteFinancieroUseCase', () => {
  let useCase: ReporteFinancieroUseCase;

  beforeEach(() => {
    useCase = new ReporteFinancieroUseCase(mockRepo as any, mockCache as any);
    jest.clearAllMocks();
    mockCache.get.mockReturnValue(null);

    mockRepo.totalRevenue.mockResolvedValue({
      _count: { id: 5 },
      _sum: { total_price: 75000, delivery_price: 50000, product_price: 25000 },
    });
    mockRepo.revenueByPaymentMethod.mockResolvedValue([
      { payment_method: 'CASH', _sum: { total_price: 40000 }, _count: { id: 3 } },
      { payment_method: 'TRANSFER', _sum: { total_price: 35000 }, _count: { id: 2 } },
    ]);
    mockRepo.settlementSummary.mockResolvedValue([
      { status: 'SETTLED', _sum: { total_earned: 10000 }, _count: { id: 2 } },
      { status: 'UNSETTLED', _sum: { total_earned: 5000 }, _count: { id: 1 } },
    ]);
  });

  it('returns financial metrics for valid range', async () => {
    const result = await useCase.execute(dto, 'co-1');

    expect(result!.revenue.total_services).toBe(5);
    expect(result!.revenue.total_price).toBe(75000);
    expect(result!.by_payment_method).toHaveLength(2);
    expect(result!.settlements.settled.total_earned).toBe(10000);
    expect(result!.settlements.unsettled.total_earned).toBe(5000);
  });

  it('throws AppException when from is missing', async () => {
    await expect(useCase.execute({ to: '2025-01-31' }, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when to is missing', async () => {
    await expect(useCase.execute({ from: '2025-01-01' }, 'co-1')).rejects.toThrow(AppException);
  });

  it('throws AppException when from >= to', async () => {
    await expect(useCase.execute({ from: '2025-02-01', to: '2025-01-01' }, 'co-1')).rejects.toThrow(AppException);
  });

  it('scopes all queries to company_id', async () => {
    await useCase.execute(dto, 'co-1');
    expect(mockRepo.totalRevenue).toHaveBeenCalledWith('co-1', expect.any(Date), expect.any(Date));
    expect(mockRepo.revenueByPaymentMethod).toHaveBeenCalledWith('co-1', expect.any(Date), expect.any(Date));
    expect(mockRepo.settlementSummary).toHaveBeenCalledWith('co-1', expect.any(Date), expect.any(Date));
  });

  it('defaults missing settlement statuses to 0', async () => {
    mockRepo.settlementSummary.mockResolvedValue([]);
    const result = await useCase.execute(dto, 'co-1');
    expect(result!.settlements.settled.count).toBe(0);
    expect(result!.settlements.unsettled.count).toBe(0);
  });
});

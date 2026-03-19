import { ReporteServiciosUseCase } from '../../../modules/reportes/application/use-cases/reporte-servicios.use-case';

const mockRepo = {
  countByStatus: jest.fn(),
  countByCourier: jest.fn(),
  avgDeliveryMinutes: jest.fn(),
  cancellationRate: jest.fn(),
  findCourierNames: jest.fn(),
};

describe('ReporteServiciosUseCase', () => {
  let useCase: ReporteServiciosUseCase;

  beforeEach(() => {
    useCase = new ReporteServiciosUseCase(mockRepo as any);
    jest.clearAllMocks();

    mockRepo.countByStatus.mockResolvedValue([
      { status: 'DELIVERED', _count: { id: 10 } },
      { status: 'CANCELLED', _count: { id: 2 } },
    ]);
    mockRepo.countByCourier.mockResolvedValue([
      { courier_id: 'c-1', _count: { id: 8 } },
    ]);
    mockRepo.avgDeliveryMinutes.mockResolvedValue(45);
    mockRepo.cancellationRate.mockResolvedValue({ total: 12, cancelled: 2, rate: 16.67 });
    mockRepo.findCourierNames.mockResolvedValue([
      { id: 'c-1', user: { name: 'Juan' } },
    ]);
  });

  it('returns all metrics scoped to company_id', async () => {
    const result = await useCase.execute({ from: '2025-01-01', to: '2025-01-31' }, 'co-1');

    expect(mockRepo.countByStatus).toHaveBeenCalledWith('co-1', expect.any(Date), expect.any(Date));
    expect(result.by_status).toHaveLength(2);
    expect(result.avg_delivery_minutes).toBe(45);
    expect(result.cancellation.rate).toBe(16.67);
  });

  it('enriches courier data with names', async () => {
    const result = await useCase.execute({}, 'co-1');
    expect(result.by_courier[0]).toMatchObject({ courier_id: 'c-1', courier_name: 'Juan', total_services: 8 });
  });

  it('handles no couriers gracefully', async () => {
    mockRepo.countByCourier.mockResolvedValue([]);
    const result = await useCase.execute({}, 'co-1');
    expect(mockRepo.findCourierNames).not.toHaveBeenCalled();
    expect(result.by_courier).toEqual([]);
  });

  it('passes courier_id filter to repo', async () => {
    await useCase.execute({ courier_id: 'c-1' }, 'co-1');
    expect(mockRepo.countByCourier).toHaveBeenCalledWith('co-1', undefined, undefined, 'c-1');
  });
});

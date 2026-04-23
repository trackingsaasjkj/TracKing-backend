import { Injectable } from '@nestjs/common';
import { ReportesRepository } from '../../infrastructure/reportes.repository';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { ReporteServiciosQueryDto } from '../dto/reporte-query.dto';

export interface ServiciosReportResult {
  period: { from: string | null; to: string | null };
  by_status: { status: string; count: number }[];
  by_courier: {
    courier_id: string;
    courier_name: string;
    total_services: number;
    settled_services: number;
    unsettled_services: number;
    total_amount: number;
    company_earnings: number;
  }[];
  avg_delivery_minutes: number | null;
  cancellation: { total: number; cancelled: number; rate: number };
}

@Injectable()
export class ReporteServiciosUseCase {
  constructor(
    private readonly repo: ReportesRepository,
    private readonly cache: CacheService,
  ) {}

  async execute(query: ReporteServiciosQueryDto, company_id: string): Promise<ServiciosReportResult> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const cacheKey = `reporte:couriers:${company_id}:${query.from ?? ''}:${query.to ?? ''}:${query.courier_id ?? ''}`;
    const cached = await this.cache.get<ServiciosReportResult>(cacheKey);
    if (cached !== null) return cached;

    const [byStatus, courierStats, avgDelivery, cancellation] = await Promise.all([
      this.repo.countByStatus(company_id, from, to),
      this.repo.getCourierStats(company_id, from, to, query.courier_id),
      this.repo.avgDeliveryMinutes(company_id, from, to),
      this.repo.cancellationRate(company_id, from, to),
    ]);

    const result = {
      period: { from: query.from ?? null, to: query.to ?? null },
      by_status: byStatus.map(r => ({ status: r.status, count: r._count.id })),
      by_courier: courierStats.map(r => ({
        courier_id: r.courier_id,
        courier_name: r.courier_name,
        total_services: r.total_services,
        settled_services: r.settled_services,
        unsettled_services: r.unsettled_services,
        total_amount: r.total_amount,
        company_earnings: r.company_earnings,
      })),
      avg_delivery_minutes: avgDelivery,
      cancellation,
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }
}

import { Injectable } from '@nestjs/common';
import { ReportesRepository } from '../../infrastructure/reportes.repository';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { AppException } from '../../../../core/errors/app.exception';
import { ReporteFinancieroQueryDto } from '../dto/reporte-query.dto';

export interface FinancieroReportResult {
  period: { from: string; to: string };
  revenue: {
    total_services: number;
    total_price: number;
    total_delivery: number;
    total_product: number;
  };
  by_payment_method: { method: string; total: number; count: number }[];
  settlements: {
    settled: { count: number; total_earned: number };
    unsettled: { count: number; total_earned: number };
  };
}

@Injectable()
export class ReporteFinancieroUseCase {
  constructor(
    private readonly repo: ReportesRepository,
    private readonly cache: CacheService,
  ) {}

  async execute(query: ReporteFinancieroQueryDto, company_id: string): Promise<FinancieroReportResult> {
    if (!query.from || !query.to) {
      throw new AppException('Los parámetros from y to son obligatorios para el reporte financiero');
    }

    const from = new Date(query.from);
    const to = new Date(query.to);

    if (from >= to) {
      throw new AppException('from debe ser anterior a to');
    }

    const cacheKey = `reporte:financiero:${company_id}:${query.from}:${query.to}`;
    const cached = await this.cache.get<FinancieroReportResult>(cacheKey);
    if (cached !== null) return cached;

    const [revenue, byPayment, settlements] = await Promise.all([
      this.repo.totalRevenue(company_id, from, to),
      this.repo.revenueByPaymentMethod(company_id, from, to),
      this.repo.settlementSummary(company_id, from, to),
    ]);

    const settled = settlements.find(s => s.status === 'SETTLED');
    const unsettled = settlements.find(s => s.status === 'UNSETTLED');

    const result: FinancieroReportResult = {
      period: { from: query.from, to: query.to },
      revenue: {
        total_services: revenue._count.id,
        total_price: Number(revenue._sum.delivery_price ?? 0),
        total_delivery: Number(revenue._sum.delivery_price ?? 0),
        total_product: 0,
      },
      by_payment_method: byPayment.map(r => ({
        method: r.payment_method,
        total: Number(r._sum.delivery_price ?? 0),
        count: r._count.id,
      })),
      settlements: {
        settled: { count: settled?._count.id ?? 0, total_earned: Number(settled?._sum.total_earned ?? 0) },
        unsettled: { count: unsettled?._count.id ?? 0, total_earned: Number(unsettled?._sum.total_earned ?? 0) },
      },
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }
}

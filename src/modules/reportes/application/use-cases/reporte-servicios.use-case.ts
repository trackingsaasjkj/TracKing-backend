import { Injectable } from '@nestjs/common';
import { ReportesRepository } from '../../infrastructure/reportes.repository';
import { ReporteServiciosQueryDto } from '../dto/reporte-query.dto';

@Injectable()
export class ReporteServiciosUseCase {
  constructor(private readonly repo: ReportesRepository) {}

  async execute(query: ReporteServiciosQueryDto, company_id: string) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const [byStatus, courierStats, avgDelivery, cancellation] = await Promise.all([
      this.repo.countByStatus(company_id, from, to),
      this.repo.getCourierStats(company_id, from, to, query.courier_id),
      this.repo.avgDeliveryMinutes(company_id, from, to),
      this.repo.cancellationRate(company_id, from, to),
    ]);

    return {
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
  }
}

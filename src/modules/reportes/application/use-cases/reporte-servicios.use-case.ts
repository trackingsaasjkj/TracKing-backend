import { Injectable } from '@nestjs/common';
import { ReportesRepository } from '../../infrastructure/reportes.repository';
import { ReporteServiciosQueryDto } from '../dto/reporte-query.dto';

@Injectable()
export class ReporteServiciosUseCase {
  constructor(private readonly repo: ReportesRepository) {}

  async execute(query: ReporteServiciosQueryDto, company_id: string) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const [byStatus, byCourier, avgDelivery, cancellation] = await Promise.all([
      this.repo.countByStatus(company_id, from, to),
      this.repo.countByCourier(company_id, from, to, query.courier_id),
      this.repo.avgDeliveryMinutes(company_id, from, to),
      this.repo.cancellationRate(company_id, from, to),
    ]);

    const courierIds = byCourier
      .map(r => r.courier_id)
      .filter((id): id is string => id !== null);

    const courierNames = courierIds.length
      ? await this.repo.findCourierNames(company_id, courierIds)
      : [];

    const nameMap = Object.fromEntries(courierNames.map(c => [c.id, c.user.name]));

    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      by_status: byStatus.map(r => ({ status: r.status, count: r._count.id })),
      by_courier: byCourier.map(r => ({
        courier_id: r.courier_id,
        courier_name: r.courier_id ? (nameMap[r.courier_id] ?? 'Unknown') : null,
        total_services: r._count.id,
      })),
      avg_delivery_minutes: avgDelivery,
      cancellation,
    };
  }
}

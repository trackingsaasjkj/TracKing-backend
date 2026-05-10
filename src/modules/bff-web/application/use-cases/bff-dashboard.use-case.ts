import { Injectable } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { ConsultarServiciosUseCase } from '../../../servicios/application/use-cases/consultar-servicios.use-case';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const ACTIVE_STATUSES: ServiceStatus[] = [
  ServiceStatus.PENDING,
  ServiceStatus.ASSIGNED,
  ServiceStatus.ACCEPTED,
  ServiceStatus.IN_TRANSIT,
];

const TERMINAL_STATUSES: ServiceStatus[] = [
  ServiceStatus.DELIVERED,
  ServiceStatus.CANCELLED,
];

/** Returns the Colombia-local date range (UTC) for a given day offset.
 *  offset=0 → today, offset=-1 → yesterday */
function bogotaDayRange(offset = 0): { start: Date; end: Date; label: string } {
  const now = new Date();
  const bogotaFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
  const todayStr = bogotaFormatter.format(now); // YYYY-MM-DD

  // Parse and apply offset
  const [y, m, d] = todayStr.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d + offset));
  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  const label = `${yyyy}-${mm}-${dd}`;

  // Bogota is UTC-5, so midnight Bogota = 05:00 UTC
  const start = new Date(`${label}T05:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

  return { start, end, label };
}

@Injectable()
export class BffDashboardUseCase {
  constructor(
    private readonly consultarServicios: ConsultarServiciosUseCase,
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(company_id: string) {
    const cacheKey = `bff:dashboard:active:${company_id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) return cached;

    const today = bogotaDayRange(0);
    const yesterday = bogotaDayRange(-1);

    const [
      allServices,
      activeCouriers,
      allCouriers,
      financial,
      todayTerminal,
      todaySettled,
      yesterdaySettled,
    ] = await Promise.all([
      this.consultarServicios.findAll(company_id, { status: ACTIVE_STATUSES }),
      this.consultarMensajeros.findAvailableAndInService(company_id),
      this.consultarMensajeros.findAll(company_id),
      this.reporteFinanciero.execute(
        { from: today.start.toISOString(), to: today.end.toISOString() },
        company_id,
      ),
      // Today terminal services (DELIVERED + CANCELLED)
      this.consultarServicios.findAll(company_id, {
        status: ServiceStatus.DELIVERED,
        deliveryFrom: today.start,
        deliveryTo: today.end,
      }).then(async (delivered) => {
        const cancelled = await this.consultarServicios.findAll(company_id, {
          status: ServiceStatus.CANCELLED,
          createdFrom: today.start,
          createdTo: today.end,
        });
        return [...delivered, ...cancelled];
      }),
      // Today settled: sum of company_commission from courier settlements generated today
      this.prisma.courierSettlement.aggregate({
        where: {
          company_id,
          generation_date: { gte: today.start, lte: today.end },
        },
        _sum: { company_commission: true },
      }),
      // Yesterday settled
      this.prisma.courierSettlement.aggregate({
        where: {
          company_id,
          generation_date: { gte: yesterday.start, lte: yesterday.end },
        },
        _sum: { company_commission: true },
      }),
    ]);

    // Courier counts by status
    const couriersByStatus = {
      available: activeCouriers.filter((c: any) => c.operational_status === 'AVAILABLE').length,
      in_service: activeCouriers.filter((c: any) => c.operational_status === 'IN_SERVICE').length,
      unavailable: (allCouriers as any[]).filter((c: any) => c.operational_status === 'UNAVAILABLE').length,
      total: (allCouriers as any[]).length,
    };

    const result = {
      pending_services: allServices,
      active_couriers: activeCouriers,
      couriers_by_status: couriersByStatus,
      today_financial: financial,
      today_terminal_services: todayTerminal,
      today_company_commission: Number(todaySettled._sum.company_commission ?? 0),
      yesterday_company_commission: Number(yesterdaySettled._sum.company_commission ?? 0),
      today_label: today.label,
      yesterday_label: yesterday.label,
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }
}

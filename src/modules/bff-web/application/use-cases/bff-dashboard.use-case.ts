import { Injectable } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { ConsultarServiciosUseCase } from '../../../servicios/application/use-cases/consultar-servicios.use-case';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';
import { CacheService } from '../../../../infrastructure/cache/cache.service';

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

@Injectable()
export class BffDashboardUseCase {
  constructor(
    private readonly consultarServicios: ConsultarServiciosUseCase,
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
    private readonly cache: CacheService,
  ) {}

  async execute(company_id: string) {
    const cacheKey = `bff:dashboard:active:${company_id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [allServices, activeCouriers, financial, todayTerminal] = await Promise.all([
      this.consultarServicios.findAll(company_id, { status: ACTIVE_STATUSES }),
      this.consultarMensajeros.findAvailableAndInService(company_id),
      this.reporteFinanciero.execute(
        { from: today, to: `${today}T23:59:59` },
        company_id,
      ),
      this.consultarServicios.findAll(company_id, {
        status: ServiceStatus.DELIVERED,
        deliveryFrom: new Date(`${today}T00:00:00`),
        deliveryTo: new Date(`${today}T23:59:59`),
      }).then(async (delivered) => {
        const cancelled = await this.consultarServicios.findAll(company_id, {
          status: ServiceStatus.CANCELLED,
          createdFrom: new Date(`${today}T00:00:00`),
          createdTo: new Date(`${today}T23:59:59`),
        });
        return [...delivered, ...cancelled];
      }),
    ]);

    const result = {
      pending_services: allServices,
      active_couriers: activeCouriers,
      today_financial: financial,
      today_terminal_services: todayTerminal,
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }
}

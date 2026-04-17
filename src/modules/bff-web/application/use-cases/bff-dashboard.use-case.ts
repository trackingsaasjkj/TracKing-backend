import { Injectable } from '@nestjs/common';
import { ConsultarServiciosUseCase } from '../../../servicios/application/use-cases/consultar-servicios.use-case';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';
import { CacheService } from '../../../../infrastructure/cache/cache.service';

@Injectable()
export class BffDashboardUseCase {
  constructor(
    private readonly consultarServicios: ConsultarServiciosUseCase,
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
    private readonly cache: CacheService,
  ) {}

  async execute(company_id: string) {
    const cacheKey = `bff:dashboard:${company_id}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [allServices, activeCouriers, financial] = await Promise.all([
      this.consultarServicios.findAll(company_id, {}),
      this.consultarMensajeros.findAvailableAndInService(company_id),
      this.reporteFinanciero.execute(
        { from: today, to: `${today}T23:59:59` },
        company_id,
      ),
    ]);

    const result = {
      pending_services: allServices,
      active_couriers: activeCouriers,
      today_financial: financial,
    };

    this.cache.set(cacheKey, result, 30);
    return result;
  }
}

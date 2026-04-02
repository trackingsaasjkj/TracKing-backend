import { Injectable } from '@nestjs/common';
import { ConsultarServiciosUseCase } from '../../../servicios/application/use-cases/consultar-servicios.use-case';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';

@Injectable()
export class BffDashboardUseCase {
  constructor(
    private readonly consultarServicios: ConsultarServiciosUseCase,
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
  ) {}

  async execute(company_id: string) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [allServices, activeCouriers, financial] = await Promise.all([
      this.consultarServicios.findAll(company_id, {}),
      this.consultarMensajeros.findActivos(company_id),
      this.reporteFinanciero.execute(
        { from: today, to: `${today}T23:59:59` },
        company_id,
      ),
    ]);

    return {
      services: allServices,
      active_couriers: activeCouriers,
      today_financial: financial,
    };
  }
}

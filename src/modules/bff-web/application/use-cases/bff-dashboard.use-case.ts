import { Injectable } from '@nestjs/common';
import { ConsultarServiciosUseCase } from '../../../servicios/application/use-cases/consultar-servicios.use-case';
import { ConsultarMensajerosUseCase } from '../../../mensajeros/application/use-cases/consultar-mensajeros.use-case';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';
import { format } from 'date-fns';

@Injectable()
export class BffDashboardUseCase {
  constructor(
    private readonly consultarServicios: ConsultarServiciosUseCase,
    private readonly consultarMensajeros: ConsultarMensajerosUseCase,
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
  ) {}

  async execute(company_id: string) {
    const today = format(new Date(), 'yyyy-MM-dd');

    const [pendingServices, activeCouriers, financial] = await Promise.all([
      this.consultarServicios.findAll(company_id, { status: 'PENDING' }),
      this.consultarMensajeros.findActivos(company_id),
      this.reporteFinanciero.execute(
        { from: today, to: `${today}T23:59:59` },
        company_id,
      ),
    ]);

    return {
      pending_services: pendingServices,
      active_couriers: activeCouriers,
      today_financial: financial,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { ReporteServiciosUseCase } from '../../../reportes/application/use-cases/reporte-servicios.use-case';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';
import { ReporteFavoritosUseCase } from '../../../reportes/application/use-cases/reporte-favoritos.use-case';
import { BffReportsQueryDto } from '../dto/bff-query.dto';
import { AppException } from '../../../../core/errors/app.exception';

@Injectable()
export class BffReportsUseCase {
  constructor(
    private readonly reporteServicios: ReporteServiciosUseCase,
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
    private readonly reporteFavoritos: ReporteFavoritosUseCase,
  ) {}

  async execute(query: BffReportsQueryDto, company_id: string) {
    if (!query.from || !query.to) {
      throw new AppException('Los parámetros from y to son obligatorios');
    }

    if (query.from >= query.to) {
      throw new AppException('El parámetro from debe ser anterior a to');
    }

    const [services, financial, customers] = await Promise.all([
      this.reporteServicios.execute(query, company_id),
      this.reporteFinanciero.execute(query, company_id),
      this.reporteFavoritos.execute(query, company_id),
    ]);

    return { services, financial, customers };
  }
}

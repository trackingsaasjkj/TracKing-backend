import { Injectable } from '@nestjs/common';
import { ReporteServiciosUseCase } from '../../../reportes/application/use-cases/reporte-servicios.use-case';
import { ReporteFinancieroUseCase } from '../../../reportes/application/use-cases/reporte-financiero.use-case';
import { BffReportsQueryDto } from '../dto/bff-query.dto';
import { AppException } from '../../../../core/errors/app.exception';

@Injectable()
export class BffReportsUseCase {
  constructor(
    private readonly reporteServicios: ReporteServiciosUseCase,
    private readonly reporteFinanciero: ReporteFinancieroUseCase,
  ) {}

  async execute(query: BffReportsQueryDto, company_id: string) {
    if (!query.from || !query.to) {
      throw new AppException('Los parámetros from y to son obligatorios');
    }

    if (query.from >= query.to) {
      throw new AppException('El parámetro from debe ser anterior a to');
    }

    const [services, financial] = await Promise.all([
      this.reporteServicios.execute(query, company_id),
      this.reporteFinanciero.execute(query, company_id),
    ]);

    return { services, financial };
  }
}

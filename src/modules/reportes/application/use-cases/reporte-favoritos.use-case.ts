import { Injectable } from '@nestjs/common';
import { ReportesRepository } from '../../infrastructure/reportes.repository';
import { ReporteFavoritosQueryDto } from '../dto/reporte-query.dto';

@Injectable()
export class ReporteFavoritosUseCase {
  constructor(private readonly repo: ReportesRepository) {}

  async execute(query: ReporteFavoritosQueryDto, company_id: string) {
    const from = query.from ? new Date(query.from) : undefined;
    const to   = query.to   ? new Date(query.to)   : undefined;
    return this.repo.getFavoriteCustomersReport(company_id, from, to, query.customer_id);
  }
}

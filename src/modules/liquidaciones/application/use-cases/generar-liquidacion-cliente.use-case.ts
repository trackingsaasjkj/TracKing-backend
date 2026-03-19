import { Injectable } from '@nestjs/common';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';
import { validarRangoFechas, validarResultadoLiquidacion } from '../../domain/rules/validar-liquidacion.rule';
import { GenerarLiquidacionClienteDto } from '../dto/generar-liquidacion-cliente.dto';

@Injectable()
export class GenerarLiquidacionClienteUseCase {
  constructor(private readonly liquidacionRepo: LiquidacionRepository) {}

  async execute(dto: GenerarLiquidacionClienteDto, company_id: string) {
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    validarRangoFechas(startDate, endDate);

    const servicios = await this.liquidacionRepo.findDeliveredServicesAllCouriers(
      company_id, startDate, endDate,
    );

    const totalServices = servicios.length;
    const totalInvoiced = servicios.reduce((sum, s) => sum + Number(s.total_price), 0);

    validarResultadoLiquidacion(totalServices, totalInvoiced);

    return this.liquidacionRepo.createCustomerSettlement({
      company_id,
      start_date: startDate,
      end_date: endDate,
      total_services: totalServices,
      total_invoiced: totalInvoiced,
    });
  }
}

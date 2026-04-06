import { Injectable, NotFoundException } from '@nestjs/common';
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

    // Validate customer belongs to company
    const customer = await this.liquidacionRepo.findCustomerById(dto.customer_id, company_id);
    if (!customer) throw new NotFoundException('Cliente no encontrado en esta empresa');

    const servicios = await this.liquidacionRepo.findDeliveredServicesByCustomer(
      company_id, dto.customer_id, startDate, endDate,
    );

    const totalServices = servicios.length;
    const totalInvoiced = servicios.reduce((sum, s) => sum + Number(s.delivery_price), 0);

    validarResultadoLiquidacion(totalServices, totalInvoiced);

    const settlement = await this.liquidacionRepo.createCustomerSettlement({
      company_id,
      customer_id: dto.customer_id,
      start_date: startDate,
      end_date: endDate,
      total_services: totalServices,
      total_invoiced: totalInvoiced,
    });

    // Marcar servicios como liquidados (customer)
    await this.liquidacionRepo.markCustomerServicesAsSettled(servicios.map(s => s.id), company_id);

    return settlement;
  }
}

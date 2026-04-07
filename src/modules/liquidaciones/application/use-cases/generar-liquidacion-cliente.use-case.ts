import { Injectable } from '@nestjs/common';
import { AppException } from '../../../../core/errors/app.exception';
import { GenerarLiquidacionClienteDto } from '../dto/generar-liquidacion-cliente.dto';
import { validarRangoFechas } from '../../domain/rules/validar-liquidacion.rule';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';

@Injectable()
export class GenerarLiquidacionClienteUseCase {
  constructor(private readonly liquidacionRepo: LiquidacionRepository) {}

  async execute(dto: GenerarLiquidacionClienteDto, company_id: string) {
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    validarRangoFechas(startDate, endDate);

    const customer = await this.liquidacionRepo.findCustomerById(dto.customer_id, company_id);
    if (!customer) {
      throw new AppException('Cliente no encontrado', 404);
    }

    const servicios = await this.liquidacionRepo.findDeliveredServicesByCustomer(
      company_id,
      dto.customer_id,
      startDate,
      endDate,
    );

    if (!servicios || servicios.length === 0) {
      throw new AppException('No hay servicios entregados en el rango de fechas indicado', 400);
    }

    const totalServices = servicios.length;
    const totalInvoiced = servicios.reduce((sum: number, s: any) => sum + Number(s.delivery_price), 0);

    const settlement = await this.liquidacionRepo.createCustomerSettlement({
      company_id,
      customer_id: dto.customer_id,
      start_date: startDate,
      end_date: endDate,
      total_services: totalServices,
      total_invoiced: totalInvoiced,
    });

    await this.liquidacionRepo.markCustomerServicesAsSettled(
      servicios.map((s: any) => s.id),
      company_id,
    );

    return {
      ...settlement,
      total_invoiced: Number(settlement.total_invoiced ?? totalInvoiced),
    };
  }
}

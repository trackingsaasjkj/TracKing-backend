import { Injectable } from '@nestjs/common';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';
import { AppException } from '../../../../core/errors/app.exception';
import { GenerarLiquidacionClienteDto } from '../dto/generar-liquidacion-cliente.dto';

@Injectable()
export class GenerarLiquidacionClienteUseCase {
  constructor(private readonly liquidacionRepo: LiquidacionRepository) {}

  async execute(dto: GenerarLiquidacionClienteDto, company_id: string) {
    if (!dto.service_ids || dto.service_ids.length === 0) {
      throw new AppException('Debe seleccionar al menos un servicio', 400);
    }

    const servicios = await this.liquidacionRepo.findServicesByIds(dto.service_ids, company_id);

    if (servicios.length !== dto.service_ids.length) {
      throw new AppException('Uno o más servicios no pertenecen a esta empresa', 400);
    }

    const notUnpaid = servicios.filter(s => s.payment_status !== 'UNPAID');
    if (notUnpaid.length > 0) {
      throw new AppException('Uno o más servicios ya han sido liquidados', 400);
    }

    const customerIds = [...new Set(servicios.map(s => s.customer_id))];
    const customer_id = customerIds[0];

    const totalServices = servicios.length;
    const totalInvoiced = servicios.reduce((sum, s) => sum + Number(s.delivery_price), 0);

    const now = new Date();
    const settlement = await this.liquidacionRepo.createCustomerSettlement({
      company_id,
      customer_id,
      start_date: now,
      end_date: now,
      total_services: totalServices,
      total_invoiced: totalInvoiced,
    });

    await this.liquidacionRepo.markServicesAsPaid(dto.service_ids, company_id);

    return {
      ...settlement,
      total_invoiced: Number(settlement.total_invoiced),
    };
  }
}
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../../core/errors/app.exception';
import { GenerarLiquidacionClienteDto } from '../dto/generar-liquidacion-cliente.dto';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';

@Injectable()
export class GenerarLiquidacionClienteUseCase {
  constructor(private readonly liquidacionRepo: LiquidacionRepository) {}

  async execute(dto: GenerarLiquidacionClienteDto, company_id: string) {
    if (!dto.service_ids || dto.service_ids.length === 0) {
      throw new AppException('Debe seleccionar al menos un servicio', 400);
    }

    // Fetch services and validate they belong to company and are not yet settled
    const servicios = await this.liquidacionRepo.findServicesByIds(dto.service_ids, company_id);

    if (servicios.length !== dto.service_ids.length) {
      throw new AppException('Uno o más servicios no pertenecen a esta empresa', 400);
    }

    const alreadySettled = servicios.filter((s: any) => s.is_settled_customer);
    if (alreadySettled.length > 0) {
      throw new AppException('Uno o más servicios ya han sido liquidados', 400);
    }

    // All services must belong to the same customer
    const customerIds = [...new Set(servicios.map((s: any) => s.customer_id))];
    const customer_id = customerIds[0];

    const totalServices = servicios.length;
    // Only UNPAID services count toward the invoiced total
    const totalInvoiced = servicios
      .filter((s: any) => s.payment_status === 'UNPAID')
      .reduce((sum: number, s: any) => sum + Number(s.delivery_price), 0);

    const now = new Date();
    const settlement = await this.liquidacionRepo.createCustomerSettlement({
      company_id,
      customer_id,
      start_date: now,
      end_date: now,
      total_services: totalServices,
      total_invoiced: totalInvoiced,
    });

    // Mark all services as settled (is_settled_customer = true)
    // UNPAID ones also get payment_status = PAID
    await this.liquidacionRepo.markServicesAsPaid(dto.service_ids, company_id);

    return {
      ...settlement,
      total_invoiced: Number(settlement.total_invoiced),
    };
  }
}

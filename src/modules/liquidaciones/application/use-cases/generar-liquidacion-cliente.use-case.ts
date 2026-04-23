import { Injectable } from '@nestjs/common';
import { AppException } from '../../../../core/errors/app.exception';
import { GenerarLiquidacionClienteDto } from '../dto/generar-liquidacion-cliente.dto';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { DecimalUtil } from '../../../../core/utils/decimal.util';

@Injectable()
export class GenerarLiquidacionClienteUseCase {
  constructor(
    private readonly liquidacionRepo: LiquidacionRepository,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: GenerarLiquidacionClienteDto, company_id: string) {
    if (!dto.service_ids || dto.service_ids.length === 0) {
      throw new AppException('Debe seleccionar al menos un servicio', 400);
    }

    // Fetch services and validate they belong to company and are not yet settled
    const servicios = await this.liquidacionRepo.findServicesByIds(dto.service_ids, company_id);

    if (servicios.length !== dto.service_ids.length) {
      throw new AppException('Uno o más servicios no pertenecen a esta empresa', 400);
    }

    // Validar que no estén liquidados
    const alreadySettled = servicios.filter((s: any) => s.is_settled_customer);
    if (alreadySettled.length > 0) {
      throw new AppException('Uno o más servicios ya han sido liquidados', 400);
    }

    // All services must belong to the same customer
    const customerIds = [...new Set(servicios.map((s: any) => s.customer_id))];
    if (customerIds.length > 1) {
      throw new AppException('Todos los servicios deben pertenecer al mismo cliente', 400);
    }

    const customer_id = customerIds[0];
    const totalServices = servicios.length;

    // Usar Decimal para precisión monetaria
    const totalInvoiced = DecimalUtil.toNumber(
      DecimalUtil.sum(
        servicios
          .filter((s: any) => s.payment_status === 'UNPAID')
          .map((s: any) => s.delivery_price),
      ),
    );

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

    // Invalidar caché de reportes para esta empresa
    await this.cache.deleteByPrefix(`reporte:financiero:${company_id}`);
    await this.cache.deleteByPrefix(`reporte:couriers:${company_id}`);

    return {
      ...settlement,
      total_invoiced: Number(settlement.total_invoiced),
    };
  }
}

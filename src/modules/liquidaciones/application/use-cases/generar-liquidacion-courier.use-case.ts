import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';
import { MensajeroRepository } from '../../../mensajeros/infrastructure/mensajero.repository';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { validarReglaActiva, validarRangoFechas, validarResultadoLiquidacion } from '../../domain/rules/validar-liquidacion.rule';
import { calcularTotalLiquidacion } from '../../domain/rules/calcular-liquidacion.rule';
import { GenerarLiquidacionCourierDto } from '../dto/generar-liquidacion-courier.dto';
import { ServiceUpdatesGateway } from '../../../servicios/services-updates.gateway';

@Injectable()
export class GenerarLiquidacionCourierUseCase {
  constructor(
    private readonly liquidacionRepo: LiquidacionRepository,
    private readonly mensajeroRepo: MensajeroRepository,
    private readonly cache: CacheService,
    @Optional() private readonly gateway: ServiceUpdatesGateway,
  ) {}

  async execute(dto: GenerarLiquidacionCourierDto, company_id: string) {
    // Build full-day UTC range from the date string (YYYY-MM-DD)
    const startDate = new Date(`${dto.start_date}T00:00:00.000Z`);
    const endDate = new Date(`${dto.end_date}T23:59:59.999Z`);

    // Spec: rangoFechasObligatorio
    validarRangoFechas(startDate, endDate);

    // Validate courier belongs to company
    const courier = await this.mensajeroRepo.findById(dto.courier_id, company_id);
    if (!courier) throw new NotFoundException('Mensajero no encontrado en esta empresa');

    // Spec: debeExistirReglaActiva
    const reglaDB = await this.liquidacionRepo.findActiveRule(company_id);

    // Si el frontend envía un override de regla, usarlo; si no, usar la regla activa de BD
    let regla: { type: 'PERCENTAGE' | 'FIXED'; value: number } | null = null;
    if (dto.rule_type !== undefined && dto.rule_value !== undefined) {
      regla = { type: dto.rule_type, value: dto.rule_value };
    } else {
      validarReglaActiva(reglaDB);
      regla = { type: reglaDB!.type as 'PERCENTAGE' | 'FIXED', value: Number(reglaDB!.value) };
    }

    // Spec: soloServiciosEntregados
    const servicios = await this.liquidacionRepo.findDeliveredServices(
      company_id, dto.courier_id, startDate, endDate,
    );

    const totalServices = servicios.length;
    const companyCommission = calcularTotalLiquidacion(
      servicios.map(s => ({ delivery_price: Number(s.delivery_price) })),
      { type: regla.type as any, value: regla.value },
    );
    const totalCollected = servicios.reduce((sum, s) => sum + Number(s.delivery_price), 0);
    const courierPayment = totalCollected - companyCommission;

    validarResultadoLiquidacion(totalServices, companyCommission);

    const settlement = await this.liquidacionRepo.createCourierSettlement({
      company_id,
      courier_id: dto.courier_id,
      start_date: startDate,
      end_date: endDate,
      total_services: totalServices,
      total_collected: totalCollected,
      company_commission: companyCommission,
      courier_payment: courierPayment,
      status: 'SETTLED',
      service_ids: servicios.map(s => s.id),
    });

    // Marcar servicios como liquidados (courier)
    await this.liquidacionRepo.markCourierServicesAsSettled(servicios.map(s => s.id), company_id);

    // Invalidar caché de reportes para esta empresa
    await this.cache.deleteByPrefix(`reporte:financiero:${company_id}`);
    this.cache.deleteByPrefix(`reporte:couriers:${company_id}`);

    const result = {
      id: settlement.id,
      courier_id: settlement.courier_id,
      total_services: settlement.total_services,
      total_collected: totalCollected,
      company_commission: companyCommission,
      courier_payment: courierPayment,
      start_date: settlement.start_date,
      end_date: settlement.end_date,
      generation_date: settlement.generation_date,
    };

    // Notify courier in real-time (foreground WS)
    if (this.gateway) {
      this.gateway.emitSettlementCreated(dto.courier_id, result as Record<string, unknown>);
    }

    return result;
  }
}

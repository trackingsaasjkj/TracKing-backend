import { Injectable, NotFoundException } from '@nestjs/common';
import { LiquidacionRepository } from '../../infrastructure/liquidacion.repository';
import { MensajeroRepository } from '../../../mensajeros/infrastructure/mensajero.repository';
import { validarReglaActiva, validarRangoFechas, validarResultadoLiquidacion } from '../../domain/rules/validar-liquidacion.rule';
import { calcularTotalLiquidacion } from '../../domain/rules/calcular-liquidacion.rule';
import { GenerarLiquidacionCourierDto } from '../dto/generar-liquidacion-courier.dto';

@Injectable()
export class GenerarLiquidacionCourierUseCase {
  constructor(
    private readonly liquidacionRepo: LiquidacionRepository,
    private readonly mensajeroRepo: MensajeroRepository,
  ) {}

  async execute(dto: GenerarLiquidacionCourierDto, company_id: string) {
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    // Spec: rangoFechasObligatorio
    validarRangoFechas(startDate, endDate);

    // Validate courier belongs to company
    const courier = await this.mensajeroRepo.findById(dto.courier_id, company_id);
    if (!courier) throw new NotFoundException('Mensajero no encontrado en esta empresa');

    // Spec: debeExistirReglaActiva
    const regla = await this.liquidacionRepo.findActiveRule(company_id);
    validarReglaActiva(regla);

    // Spec: soloServiciosEntregados
    const servicios = await this.liquidacionRepo.findDeliveredServices(
      company_id, dto.courier_id, startDate, endDate,
    );

    const totalServices = servicios.length;
    const totalEarned = calcularTotalLiquidacion(
      servicios.map(s => ({ delivery_price: Number(s.delivery_price) })),
      { type: regla!.type as any, value: Number(regla!.value) },
    );

    // Spec: totalServiciosDebeCoincidir + totalGanadoDebeSerPositivo
    validarResultadoLiquidacion(totalServices, totalEarned);

    return this.liquidacionRepo.createCourierSettlement({
      company_id,
      courier_id: dto.courier_id,
      start_date: startDate,
      end_date: endDate,
      total_services: totalServices,
      total_earned: totalEarned,
    });
  }
}

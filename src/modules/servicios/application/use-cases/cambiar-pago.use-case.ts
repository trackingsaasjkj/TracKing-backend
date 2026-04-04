import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { CambiarPagoDto } from '../dto/cambiar-pago.dto';
import { resolverCambioAPagado, resolverCambioANoPagado } from '../../domain/rules/validar-pago.rule';

@Injectable()
export class CambiarPagoUseCase {
  constructor(private readonly servicioRepo: ServicioRepository) {}

  async execute(service_id: string, dto: CambiarPagoDto, company_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    const update =
      dto.payment_status === PaymentStatus.UNPAID
        ? resolverCambioANoPagado()
        : resolverCambioAPagado();

    await this.servicioRepo.update(service_id, company_id, update);
    return this.servicioRepo.findById(service_id, company_id);
  }
}

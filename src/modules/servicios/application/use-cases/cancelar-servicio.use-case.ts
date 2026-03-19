import { Injectable, NotFoundException } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { CourierRepository } from '../../infrastructure/repositories/courier.repository';
import { ServicioStateMachine } from '../../domain/state-machine/servicio.machine';
import { AppException } from '../../../../core/errors/app.exception';

@Injectable()
export class CancelarServicioUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly historialRepo: HistorialRepository,
    private readonly courierRepo: CourierRepository,
  ) {}

  async execute(service_id: string, company_id: string, user_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    if (!ServicioStateMachine.canBeCancelled(servicio.status as any)) {
      throw new AppException(`No se puede cancelar un servicio en estado ${servicio.status}`);
    }

    await this.servicioRepo.update(service_id, company_id, { status: 'CANCELLED' });

    // Free courier if one was assigned
    if (servicio.courier_id) {
      await this.courierRepo.updateStatus(servicio.courier_id, company_id, 'AVAILABLE');
    }

    await this.historialRepo.create({
      company_id,
      service_id,
      previous_status: servicio.status as any,
      new_status: 'CANCELLED',
      user_id,
    });

    return this.servicioRepo.findById(service_id, company_id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { CourierRepository } from '../../infrastructure/repositories/courier.repository';
import { ServicioStateMachine } from '../../domain/state-machine/servicio.machine';
import { AppException } from '../../../../core/errors/app.exception';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { NotificationsUseCases } from '../../../notifications/application/use-cases/notifications.use-cases';

@Injectable()
export class CancelarServicioUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly historialRepo: HistorialRepository,
    private readonly courierRepo: CourierRepository,
    private readonly cache: CacheService,
    private readonly notifications: NotificationsUseCases,
  ) {}

  async execute(service_id: string, company_id: string, user_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    if (!ServicioStateMachine.canBeCancelled(servicio.status as any)) {
      throw new AppException(`No se puede cancelar un servicio en estado ${servicio.status}`);
    }

    // Guardar courier_id antes de cancelar para notificar después
    const courierId = servicio.courier_id;

    await this.servicioRepo.update(service_id, company_id, { status: 'CANCELLED' });

    // Free courier if one was assigned, ONLY if they have no other active services
    if (courierId) {
      const activeCount = await this.courierRepo.countActiveServices(courierId, company_id);
      if (activeCount === 0) {
        await this.courierRepo.updateStatus(courierId, company_id, 'AVAILABLE');
      }
    }

    await this.historialRepo.create({
      company_id,
      service_id,
      previous_status: servicio.status as any,
      new_status: 'CANCELLED',
      user_id,
    });

    this.cache.delete(`bff:dashboard:active:${company_id}`);
    this.cache.delete(`bff:active-orders:active:${company_id}`);
    this.cache.deleteByPrefix(`reporte:financiero:${company_id}`);

    // Caso 2: notificar al mensajero que tenía asignado el servicio
    if (courierId) {
      await this.notifications.notifyServiceUpdate(
        courierId,
        service_id,
        company_id,
        'Un servicio que tenías asignado ha sido cancelado.',
      );
    }

    return this.servicioRepo.findById(service_id, company_id);
  }
}

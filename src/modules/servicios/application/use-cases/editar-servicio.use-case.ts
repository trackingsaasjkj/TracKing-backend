import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { NotificationsUseCases } from '../../../notifications/application/use-cases/notifications.use-cases';
import { EditarServicioDto } from '../dto/editar-servicio.dto';

/** Estados en los que NO se permite editar el servicio */
const ESTADOS_NO_EDITABLES = ['DELIVERED', 'CANCELLED'];

@Injectable()
export class EditarServicioUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly notifications: NotificationsUseCases,
  ) {}

  async execute(service_id: string, dto: EditarServicioDto, company_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    if (ESTADOS_NO_EDITABLES.includes(servicio.status)) {
      throw new BadRequestException(
        `No se puede editar un servicio en estado ${servicio.status}`,
      );
    }

    // Recalcular total_price si cambia algún precio
    const delivery_price = dto.delivery_price ?? servicio.delivery_price;
    const product_price = dto.product_price ?? servicio.product_price;
    const total_price = delivery_price + product_price;

    await this.servicioRepo.update(service_id, company_id, {
      ...dto,
      ...(dto.delivery_price !== undefined || dto.product_price !== undefined
        ? { delivery_price, product_price, total_price }
        : {}),
    });

    // Caso 3: notificar al mensajero asignado si lo hay
    if (servicio.courier_id) {
      await this.notifications.notifyServiceUpdate(
        servicio.courier_id,
        service_id,
        company_id,
        'El servicio asignado ha sido actualizado. Revisa los nuevos detalles.',
      );
    }

    return this.servicioRepo.findById(service_id, company_id);
  }
}

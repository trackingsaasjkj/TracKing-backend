import { Injectable, NotFoundException } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { CourierRepository } from '../../infrastructure/repositories/courier.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { validarAsignacion } from '../../domain/rules/validar-asignacion.rule';
import { validarTransicion } from '../../domain/rules/validar-transicion.rule';
import { AsignarServicioDto } from '../dto/asignar-servicio.dto';

@Injectable()
export class AsignarServicioUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly courierRepo: CourierRepository,
    private readonly historialRepo: HistorialRepository,
  ) {}

  async execute(service_id: string, dto: AsignarServicioDto, company_id: string, user_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    const courier = await this.courierRepo.findById(dto.courier_id, company_id);

    // Domain rules — throws AppException on violation
    validarAsignacion({ courier, estado: servicio.status as any });
    validarTransicion(servicio.status as any, 'ASSIGNED');

    await this.servicioRepo.update(service_id, company_id, {
      courier_id: dto.courier_id,
      status: 'ASSIGNED',
      assignment_date: new Date(),
    });

    // Mark courier as IN_SERVICE
    await this.courierRepo.updateStatus(dto.courier_id, company_id, 'IN_SERVICE');

    await this.historialRepo.create({
      company_id,
      service_id,
      previous_status: servicio.status as any,
      new_status: 'ASSIGNED',
      user_id,
    });

    return this.servicioRepo.findById(service_id, company_id);
  }
}

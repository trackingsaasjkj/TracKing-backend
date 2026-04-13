import { Injectable, NotFoundException } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { EvidenceRepository } from '../../infrastructure/repositories/evidence.repository';
import { CourierRepository } from '../../infrastructure/repositories/courier.repository';
import { validarTransicion } from '../../domain/rules/validar-transicion.rule';
import { validarEntrega } from '../../domain/rules/validar-entrega.rule';
import { ServicioEstado } from '../../domain/state-machine/servicio.machine';
import { CambiarEstadoDto } from '../dto/cambiar-estado.dto';
import { CacheService } from '../../../../infrastructure/cache/cache.service';

@Injectable()
export class CambiarEstadoUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly historialRepo: HistorialRepository,
    private readonly evidenceRepo: EvidenceRepository,
    private readonly courierRepo: CourierRepository,
    private readonly cache: CacheService,
  ) {}

  async execute(service_id: string, dto: CambiarEstadoDto, company_id: string, user_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    const nuevoEstado = dto.status as ServicioEstado;

    validarTransicion(servicio.status as ServicioEstado, nuevoEstado);

    if (nuevoEstado === 'DELIVERED') {
      const evidencia = await this.evidenceRepo.findByServiceId(service_id, company_id);
      validarEntrega({ estado: servicio.status as ServicioEstado, evidencia });
    }

    const updateData: any = { status: nuevoEstado };
    if (nuevoEstado === 'DELIVERED') updateData.delivery_date = new Date();

    await this.servicioRepo.update(service_id, company_id, updateData);

    // Free courier when service reaches a final state
    if ((nuevoEstado === 'DELIVERED' || nuevoEstado === 'CANCELLED') && servicio.courier_id) {
      await this.courierRepo.updateStatus(servicio.courier_id, company_id, 'AVAILABLE');
    }

    await this.historialRepo.create({
      company_id,
      service_id,
      previous_status: servicio.status as any,
      new_status: nuevoEstado as any,
      user_id,
    });

    this.cache.deleteByPrefix(`bff:dashboard:${company_id}`);
    this.cache.deleteByPrefix(`bff:active-orders:${company_id}`);

    return this.servicioRepo.findById(service_id, company_id);
  }
}

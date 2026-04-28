import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { EvidenceRepository } from '../../infrastructure/repositories/evidence.repository';
import { CourierRepository } from '../../infrastructure/repositories/courier.repository';
import { validarTransicion } from '../../domain/rules/validar-transicion.rule';
import { validarEntrega } from '../../domain/rules/validar-entrega.rule';
import { ServicioEstado } from '../../domain/state-machine/servicio.machine';
import { CambiarEstadoDto } from '../dto/cambiar-estado.dto';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { ServiceUpdatesGateway } from '../../services-updates.gateway';
import { DashboardUpdatesGateway } from '../../dashboard-updates.gateway';
import { NotificationsUseCases } from '../../../notifications/application/use-cases/notifications.use-cases';

@Injectable()
export class CambiarEstadoUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly historialRepo: HistorialRepository,
    private readonly evidenceRepo: EvidenceRepository,
    private readonly courierRepo: CourierRepository,
    private readonly cache: CacheService,
    @Optional() private readonly gateway: ServiceUpdatesGateway,
    @Optional() private readonly dashboardGateway: DashboardUpdatesGateway,
    @Optional() private readonly notificationsUseCases: NotificationsUseCases,
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
    // Auto-settle customer if service has settle_immediately = true
    if (nuevoEstado === 'DELIVERED' && (servicio as any).settle_immediately) {
      updateData.is_settled_customer = true;
    }

    await this.servicioRepo.update(service_id, company_id, updateData);

    // Free courier when service reaches a final state, ONLY if they have no other active services
    if ((nuevoEstado === 'DELIVERED' || nuevoEstado === 'CANCELLED') && servicio.courier_id) {
      const activeCount = await this.courierRepo.countActiveServices(servicio.courier_id, company_id);
      if (activeCount === 0) {
        await this.courierRepo.updateStatus(servicio.courier_id, company_id, 'AVAILABLE');
      }
    }

    await this.historialRepo.create({
      company_id,
      service_id,
      previous_status: servicio.status as any,
      new_status: nuevoEstado as any,
      user_id,
    });

    this.cache.delete(`bff:dashboard:active:${company_id}`);
    this.cache.delete(`bff:active-orders:active:${company_id}`);
    this.cache.deleteByPrefix(`reporte:financiero:${company_id}`);

    const updatedService = await this.servicioRepo.findById(service_id, company_id);

    // Broadcast WebSocket update to the courier (non-blocking)
    if (servicio.courier_id && this.gateway && updatedService) {
      this.gateway.emitServiceUpdate(servicio.courier_id, updatedService as Record<string, unknown>);
    }

    // Broadcast to admin/aux dashboard in real-time
    if (this.dashboardGateway && updatedService) {
      this.dashboardGateway.emitServiceUpdated(company_id, updatedService as Record<string, unknown>);
      this.dashboardGateway.emitDashboardRefresh(company_id);
    }

    // FCM push for background/killed state (fire-and-forget)
    if (servicio.courier_id && this.notificationsUseCases && updatedService) {
      void this.notificationsUseCases.notifyServiceStatusChange(
        servicio.courier_id,
        company_id,
        updatedService as Record<string, unknown>,
      );
    }

    return updatedService;
  }
}

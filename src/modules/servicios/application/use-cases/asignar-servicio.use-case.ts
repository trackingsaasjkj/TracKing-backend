import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { CourierRepository } from '../../infrastructure/repositories/courier.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { validarAsignacion } from '../../domain/rules/validar-asignacion.rule';
import { validarTransicion } from '../../domain/rules/validar-transicion.rule';
import { AsignarServicioDto } from '../dto/asignar-servicio.dto';
import { NotificationsUseCases } from '../../../notifications/application/use-cases/notifications.use-cases';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { ServiceUpdatesGateway } from '../../services-updates.gateway';
import { DashboardUpdatesGateway } from '../../dashboard-updates.gateway';

@Injectable()
export class AsignarServicioUseCase {
  constructor(
    private readonly servicioRepo: ServicioRepository,
    private readonly courierRepo: CourierRepository,
    private readonly historialRepo: HistorialRepository,
    private readonly notifications: NotificationsUseCases,
    private readonly cache: CacheService,
    @Optional() private readonly gateway: ServiceUpdatesGateway,
    @Optional() private readonly dashboardGateway: DashboardUpdatesGateway,
  ) {}

  async execute(service_id: string, dto: AsignarServicioDto, company_id: string, user_id: string) {
    const servicio = await this.servicioRepo.findById(service_id, company_id);
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    const courier = await this.courierRepo.findById(dto.courier_id, company_id);

    // Domain rules — throws AppException on violation
    validarAsignacion({ courier, estado: servicio.status as any });

    const isReassignment = servicio.status !== 'PENDING';

    // Solo validar transición cuando es una asignación nueva (PENDING → ASSIGNED)
    // En reasignación (ASSIGNED/ACCEPTED → mismo estado) no aplicamos la máquina de estados
    if (!isReassignment) {
      validarTransicion(servicio.status as any, 'ASSIGNED');
    }

    // Si había un mensajero previo diferente, liberarlo
    if (servicio.courier_id && servicio.courier_id !== dto.courier_id) {
      // Verificar si el mensajero anterior aún tiene otros servicios activos
      const activeCount = await this.courierRepo.countActiveServices(servicio.courier_id, company_id);
      // Restar 1 porque este servicio todavía está a su nombre en DB
      if (activeCount <= 1) {
        await this.courierRepo.updateStatus(servicio.courier_id, company_id, 'AVAILABLE');
      }
    }

    await this.servicioRepo.update(service_id, company_id, {
      courier_id: dto.courier_id,
      // En reasignación mantiene el estado actual; en asignación nueva pasa a ASSIGNED
      status: isReassignment ? (servicio.status as any) : 'ASSIGNED',
      assignment_date: isReassignment ? undefined : new Date(),
    });

    // Mark new courier as IN_SERVICE
    await this.courierRepo.updateStatus(dto.courier_id, company_id, 'IN_SERVICE');

    await this.historialRepo.create({
      company_id,
      service_id,
      previous_status: servicio.status as any,
      new_status: isReassignment ? (servicio.status as any) : 'ASSIGNED',
      user_id,
    });

    // Invalidar cachés del BFF
    this.cache.delete(`bff:dashboard:active:${company_id}`);
    this.cache.delete(`bff:active-orders:active:${company_id}`);

    const updatedService = await this.servicioRepo.findById(service_id, company_id);

    // Emit WS event to the courier (foreground real-time update)
    if (this.gateway && updatedService) {
      this.gateway.emitServiceAssigned(dto.courier_id, updatedService as Record<string, unknown>);
    }

    // Emit dashboard refresh to ADMIN/AUX
    if (this.dashboardGateway && updatedService) {
      this.dashboardGateway.emitServiceUpdated(company_id, updatedService as Record<string, unknown>);
      this.dashboardGateway.emitDashboardRefresh(company_id);
    }

    // FCM push for background/killed state (fire-and-forget)
    await this.notifications.notifyNewService(dto.courier_id, service_id, company_id);

    return updatedService;
  }
}

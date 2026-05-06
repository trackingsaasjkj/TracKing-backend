import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CourierRepository } from '../../infrastructure/repositories/courier.repository';
import { ServicioRepository } from '../../infrastructure/repositories/servicio.repository';
import { HistorialRepository } from '../../infrastructure/repositories/historial.repository';
import { NotificationsUseCases } from '../../../notifications/application/use-cases/notifications.use-cases';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { AutoAssignMode } from '@prisma/client';

@Injectable()
export class AutoAsignarServicioUseCase {
  private readonly logger = new Logger(AutoAsignarServicioUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courierRepo: CourierRepository,
    private readonly servicioRepo: ServicioRepository,
    private readonly historialRepo: HistorialRepository,
    private readonly notifications: NotificationsUseCases,
    private readonly cache: CacheService,
  ) {}

  /**
   * Intenta autoasignar un servicio recién creado según el modo configurado en la empresa.
   * Si no hay mensajeros disponibles o no hay modo configurado, el servicio queda en PENDING.
   * Nunca lanza excepción — los errores se loguean y el servicio queda sin asignar.
   */
  async tryAutoAssign(service_id: string, company_id: string, user_id: string): Promise<void> {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: company_id },
        select: { auto_assign_mode: true },
      });

      if (!company?.auto_assign_mode) return;

      const courierId = await this.selectCourier(company.auto_assign_mode, company_id);
      if (!courierId) {
        this.logger.warn(`[AutoAssign] No hay mensajero disponible para servicio ${service_id}`);
        return;
      }

      await this.assignToCourier(service_id, company_id, courierId, user_id);
      this.logger.log(`[AutoAssign] Servicio ${service_id} autoasignado a mensajero ${courierId} (modo: ${company.auto_assign_mode})`);
    } catch (err) {
      this.logger.error(`[AutoAssign] Error al autoasignar servicio ${service_id}: ${(err as Error).message}`);
    }
  }

  // ─── Selector de mensajero según modo ──────────────────────────────────────

  private async selectCourier(mode: AutoAssignMode, company_id: string): Promise<string | null> {
    switch (mode) {
      case 'LEAST_SERVICES_TODAY':
        return this.selectByLeastServicesToday(company_id);
      default:
        return null;
    }
  }

  /**
   * Modo LEAST_SERVICES_TODAY:
   * 1. Prioridad: mensajeros AVAILABLE, ordenados por servicios entregados hoy (asc).
   * 2. Si ninguno está AVAILABLE, usa mensajeros IN_SERVICE con menos servicios hoy.
   * 3. Mensajeros UNAVAILABLE son ignorados siempre.
   */
  private async selectByLeastServicesToday(company_id: string): Promise<string | null> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Obtener todos los mensajeros activos (AVAILABLE o IN_SERVICE) con su conteo de servicios hoy
    const couriers = await this.prisma.courier.findMany({
      where: {
        company_id,
        operational_status: { in: ['AVAILABLE', 'IN_SERVICE'] },
      },
      select: {
        id: true,
        operational_status: true,
        _count: {
          select: {
            services: {
              where: {
                company_id,
                created_at: { gte: todayStart, lte: todayEnd },
                status: { not: 'CANCELLED' },
              },
            },
          },
        },
      },
    });

    if (couriers.length === 0) return null;

    // Separar por estado y ordenar por conteo ascendente
    const available = couriers
      .filter(c => c.operational_status === 'AVAILABLE')
      .sort((a, b) => a._count.services - b._count.services);

    if (available.length > 0) return available[0].id;

    // Fallback: IN_SERVICE con menos servicios hoy
    const inService = couriers
      .filter(c => c.operational_status === 'IN_SERVICE')
      .sort((a, b) => a._count.services - b._count.services);

    return inService.length > 0 ? inService[0].id : null;
  }

  // ─── Asignación efectiva ────────────────────────────────────────────────────

  private async assignToCourier(
    service_id: string,
    company_id: string,
    courier_id: string,
    user_id: string,
  ): Promise<void> {
    await this.servicioRepo.update(service_id, company_id, {
      courier_id,
      status: 'ASSIGNED',
      assignment_date: new Date(),
    });

    await this.courierRepo.updateStatus(courier_id, company_id, 'IN_SERVICE');

    await this.historialRepo.create({
      company_id,
      service_id,
      previous_status: 'PENDING',
      new_status: 'ASSIGNED',
      user_id,
    });

    this.cache.delete(`bff:dashboard:active:${company_id}`);
    this.cache.delete(`bff:active-orders:active:${company_id}`);

    // Notificar al mensajero (fire-and-forget)
    this.notifications.notifyNewService(courier_id, service_id, company_id).catch((err) => {
      this.logger.warn(`[AutoAssign] No se pudo notificar al mensajero ${courier_id}: ${(err as Error).message}`);
    });
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from '../../infrastructure/notifications.repository';
import { FirebaseService } from '../../infrastructure/firebase.service';
import { RegisterTokenDto } from '../dto/register-token.dto';
import { SendNotificationDto, NotificationType } from '../dto/send-notification.dto';

@Injectable()
export class NotificationsUseCases {
  private readonly logger = new Logger(NotificationsUseCases.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * Registra o actualiza el FCM token del mensajero autenticado.
   */
  async registerToken(dto: RegisterTokenDto, userId: string, companyId: string): Promise<void> {
    await this.repo.upsertFcmToken(userId, companyId, dto.token);
    this.logger.log(`[FCM] Token registrado para user ${userId}`);
  }

  /**
   * Elimina el FCM token del mensajero (al hacer logout).
   */
  async clearToken(userId: string, companyId: string): Promise<void> {
    await this.repo.clearFcmToken(userId, companyId);
  }

  /**
   * Envía una notificación push a un mensajero específico.
   * Usado internamente por otros módulos (servicios, liquidaciones, etc.)
   */
  async sendToCourier(dto: SendNotificationDto, companyId: string): Promise<{ sent: boolean }> {
    const token = await this.repo.getFcmTokenByCourierId(dto.courierId, companyId);

    if (!token) {
      this.logger.warn(`[FCM] Mensajero ${dto.courierId} no tiene FCM token registrado`);
      return { sent: false };
    }

    const data: Record<string, string> = {
      type: dto.type,
      ...(dto.data ?? {}),
    };

    const sent = await this.firebase.sendToDevice({
      token,
      title: dto.title,
      body: dto.body,
      data,
    });

    return { sent };
  }

  /**
   * Envía una notificación a todos los mensajeros activos de la empresa.
   */
  async sendToAllCouriers(
    companyId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    const tokens = await this.repo.getAllActiveFcmTokens(companyId);

    if (tokens.length === 0) {
      this.logger.warn(`[FCM] No hay mensajeros con token en empresa ${companyId}`);
      return { successCount: 0, failureCount: 0 };
    }

    const result = await this.firebase.sendToMultipleDevices(tokens, title, body, data);
    this.logger.log(
      `[FCM] Broadcast empresa ${companyId}: ${result.successCount} ok, ${result.failureCount} fallidos`,
    );

    return { successCount: result.successCount, failureCount: result.failureCount };
  }

  // ─── Helpers para uso desde otros módulos ────────────────────────────────────

  async notifyNewService(courierId: string, serviceId: string, companyId: string): Promise<void> {
    await this.sendToCourier(
      {
        courierId,
        title: '📦 Nuevo servicio asignado',
        body: 'Tienes un nuevo servicio. Toca para ver los detalles.',
        type: NotificationType.NEW_SERVICE,
        data: { serviceId },
      },
      companyId,
    );
  }

  async notifyServiceUpdate(
    courierId: string,
    serviceId: string,
    companyId: string,
    message: string,
  ): Promise<void> {
    await this.sendToCourier(
      {
        courierId,
        title: '🔄 Actualización de servicio',
        body: message,
        type: NotificationType.SERVICE_UPDATE,
        data: { serviceId },
      },
      companyId,
    );
  }

  async notifySettlementReady(courierId: string, companyId: string): Promise<void> {
    await this.sendToCourier(
      {
        courierId,
        title: '💰 Liquidación disponible',
        body: 'Tu liquidación está lista para revisar.',
        type: NotificationType.SETTLEMENT_READY,
        data: {},
      },
      companyId,
    );
  }

  /**
   * Envía notificación FCM silenciosa con el payload completo del servicio.
   * Usada por CambiarEstadoUseCase para actualizar el store mobile en background/killed state.
   * El campo `data.payload` contiene el servicio serializado para evitar un fetch adicional.
   */
  async notifyServiceStatusChange(
    courierId: string,
    companyId: string,
    service: Record<string, unknown>,
  ): Promise<void> {
    const token = await this.repo.getFcmTokenByCourierId(courierId, companyId);
    if (!token) return;

    const status = service['status'] as string ?? '';
    const serviceId = service['id'] as string ?? '';
    const shortId = serviceId.slice(-6);

    let payloadStr: string;
    try {
      payloadStr = JSON.stringify(service);
    } catch {
      payloadStr = '{}';
    }

    await this.firebase.sendToDevice({
      token,
      title: this.getStatusTitle(status),
      body: `Servicio #${shortId} actualizado`,
      data: {
        type: 'SERVICE_UPDATE',
        serviceId,
        status,
        payload: payloadStr,
      },
    });
  }

  private getStatusTitle(status: string): string {
    const titles: Record<string, string> = {
      ACCEPTED: '✅ Servicio aceptado',
      IN_TRANSIT: '🚚 Servicio en tránsito',
      DELIVERED: '📦 Servicio entregado',
      CANCELLED: '❌ Servicio cancelado',
    };
    return titles[status] ?? '🔄 Actualización de servicio';
  }
}

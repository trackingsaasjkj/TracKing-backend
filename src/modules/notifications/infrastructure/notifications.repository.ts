import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Guarda o actualiza el FCM token del mensajero.
   * Usa el user_id para encontrar el courier asociado al usuario autenticado.
   */
  async upsertFcmToken(userId: string, companyId: string, token: string): Promise<void> {
    await this.prisma.courier.updateMany({
      where: { user_id: userId, company_id: companyId },
      data: { fcm_token: token },
    });
  }

  /**
   * Obtiene el FCM token de un courier por su ID.
   */
  async getFcmTokenByCourierId(courierId: string, companyId: string): Promise<string | null> {
    const courier = await this.prisma.courier.findFirst({
      where: { id: courierId, company_id: companyId },
      select: { fcm_token: true },
    });
    return courier?.fcm_token ?? null;
  }

  /**
   * Obtiene los FCM tokens de todos los mensajeros activos de una empresa.
   */
  async getAllActiveFcmTokens(companyId: string): Promise<string[]> {
    const couriers = await this.prisma.courier.findMany({
      where: {
        company_id: companyId,
        fcm_token: { not: null },
        user: { status: 'ACTIVE' },
      },
      select: { fcm_token: true },
    });
    return couriers.map((c) => c.fcm_token!).filter(Boolean);
  }

  /**
   * Elimina el FCM token del mensajero (logout).
   */
  async clearFcmToken(userId: string, companyId: string): Promise<void> {
    await this.prisma.courier.updateMany({
      where: { user_id: userId, company_id: companyId },
      data: { fcm_token: null },
    });
  }
}

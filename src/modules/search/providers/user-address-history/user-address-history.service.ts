import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SearchBoxSuggestion } from '../search-provider.interface';

@Injectable()
export class UserAddressHistoryService {
  private readonly logger = new Logger(UserAddressHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el historial de direcciones de un usuario
   * Ordena por uso más reciente y frecuente
   */
  async getHistory(
    userId: string,
    companyId: string,
    limit: number = 10,
  ): Promise<SearchBoxSuggestion[]> {
    try {
      const history = await this.prisma.userAddressHistory.findMany({
        where: {
          user_id: userId,
          company_id: companyId,
        },
        take: limit,
        orderBy: [
          {
            last_used_at: 'desc',
          },
          {
            used_count: 'desc',
          },
        ],
      });

      this.logger.log(`Retrieved ${history.length} addresses | userId: ${userId} | company: ${companyId}`);

      return history.map(h => ({
        name: h.main_text || h.address,
        place_name: h.address,
        center: [parseFloat(h.lng?.toString() || '0'), parseFloat(h.lat?.toString() || '0')] as [number, number],
        place_type: ['place'],
        context: {
          place: { name: h.main_text || '' },
          country: { name: 'Colombia' },
        },
      }));
    } catch (err: any) {
      this.logger.error(`Error retrieving address history: ${err.message}`);
      return [];
    }
  }

  /**
   * Registra o actualiza una dirección en el historial
   */
  async recordAddress(
    userId: string,
    companyId: string,
    suggestion: SearchBoxSuggestion,
  ): Promise<void> {
    try {
      const placeId = (suggestion as any).place_id || `${suggestion.center[0]}_${suggestion.center[1]}`;

      await this.prisma.userAddressHistory.upsert({
        where: {
          user_id_company_id_address: {
            user_id: userId,
            company_id: companyId,
            address: suggestion.place_name,
          },
        },
        update: {
          used_count: {
            increment: 1,
          },
          last_used_at: new Date(),
        },
        create: {
          user_id: userId,
          company_id: companyId,
          address: suggestion.place_name,
          place_id: placeId,
          lat: suggestion.center[1],
          lng: suggestion.center[0],
          main_text: suggestion.name,
          secondary_text: suggestion.context?.place?.name,
          used_count: 1,
          last_used_at: new Date(),
        },
      });

      this.logger.log(`Recorded address | userId: ${userId} | address: ${suggestion.place_name}`);
    } catch (err: any) {
      this.logger.error(`Error recording address: ${err.message}`);
    }
  }

  /**
   * Elimina una dirección del historial
   */
  async deleteAddress(
    userId: string,
    companyId: string,
    address: string,
  ): Promise<void> {
    try {
      await this.prisma.userAddressHistory.delete({
        where: {
          user_id_company_id_address: {
            user_id: userId,
            company_id: companyId,
            address: address,
          },
        },
      });

      this.logger.log(`Deleted address | userId: ${userId} | address: ${address}`);
    } catch (err: any) {
      this.logger.error(`Error deleting address: ${err.message}`);
    }
  }

  /**
   * Limpia direcciones antiguas del historial
   * Mantiene solo las últimas 100 direcciones por usuario
   */
  async cleanupOldAddresses(userId?: string): Promise<void> {
    try {
      if (userId) {
        // Limpiar para un usuario específico
        const old = await this.prisma.userAddressHistory.findMany({
          where: {
            user_id: userId,
          },
          orderBy: {
            last_used_at: 'desc',
          },
          skip: 100,
          select: {
            id: true,
          },
        });

        if (old.length > 0) {
          await this.prisma.userAddressHistory.deleteMany({
            where: {
              id: {
                in: old.map(o => o.id),
              },
            },
          });
          this.logger.log(`Cleaned up ${old.length} old addresses for user: ${userId}`);
        }
      } else {
        // Limpiar direcciones con más de 90 días sin usar
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);

        const deleted = await this.prisma.userAddressHistory.deleteMany({
          where: {
            last_used_at: {
              lt: cutoffDate,
            },
          },
        });

        this.logger.log(`Cleaned up ${deleted.count} addresses older than 90 days`);
      }
    } catch (err: any) {
      this.logger.error(`Error during cleanup: ${err.message}`);
    }
  }
}

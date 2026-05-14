import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SearchBoxSuggestion } from '../search-provider.interface';

@Injectable()
export class GooglePlacesCacheService {
  private readonly logger = new Logger(GooglePlacesCacheService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normaliza una query para búsqueda en cache
   */
  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Busca en cache local de BD
   */
  async searchCache(
    companyId: string,
    query: string,
    limit: number = 5,
  ): Promise<SearchBoxSuggestion[]> {
    const normalized = this.normalizeQuery(query);

    try {
      const cached = await this.prisma.googlePlacesCache.findMany({
        where: {
          company_id: companyId,
          normalized_query: normalized,
        },
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
      });

      if (cached.length > 0) {
        this.logger.log(`Cache hit | company: ${companyId} | query: ${normalized} | results: ${cached.length}`);
      }

      return cached.map(c => ({
        name: c.main_text || c.address,
        place_name: c.address,
        center: [parseFloat(c.lng.toString()), parseFloat(c.lat.toString())] as [number, number],
        place_type: ['place'],
        context: {
          place: { name: c.main_text || '' },
          country: { name: 'Colombia' },
        },
      }));
    } catch (err: any) {
      this.logger.error(`Cache search error: ${err.message}`);
      return [];
    }
  }

  /**
   * Guarda resultados en cache
   */
  async saveCache(
    companyId: string,
    query: string,
    suggestions: SearchBoxSuggestion[],
  ): Promise<void> {
    const normalized = this.normalizeQuery(query);

    try {
      for (const suggestion of suggestions) {
        // Extraer place_id si está disponible en el contexto
        const placeId = (suggestion as any).place_id || `${suggestion.center[0]}_${suggestion.center[1]}`;

        await this.prisma.googlePlacesCache.upsert({
          where: {
            company_id_normalized_query_place_id: {
              company_id: companyId,
              normalized_query: normalized,
              place_id: placeId,
            },
          },
          update: {
            updated_at: new Date(),
          },
          create: {
            company_id: companyId,
            normalized_query: normalized,
            place_id: placeId,
            address: suggestion.place_name,
            lat: suggestion.center[1],
            lng: suggestion.center[0],
            main_text: suggestion.name,
            secondary_text: suggestion.context?.place?.name,
          },
        });
      }

      this.logger.log(`Cached ${suggestions.length} results | company: ${companyId} | query: ${normalized}`);
    } catch (err: any) {
      this.logger.error(`Cache save error: ${err.message}`);
    }
  }

  /**
   * Limpia cache antiguo (más de 30 días)
   */
  async cleanupOldCache(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const deleted = await this.prisma.googlePlacesCache.deleteMany({
        where: {
          created_at: {
            lt: thirtyDaysAgo,
          },
        },
      });

      if (deleted.count > 0) {
        this.logger.log(`Cleaned up ${deleted.count} old cache entries`);
      }
    } catch (err: any) {
      this.logger.error(`Cache cleanup error: ${err.message}`);
    }
  }

  /**
   * Guarda detalles de un lugar (Place Details)
   */
  async savePlaceDetails(
    companyId: string,
    placeId: string,
    suggestion: SearchBoxSuggestion,
  ): Promise<void> {
    try {
      await this.prisma.googlePlacesCache.upsert({
        where: {
          company_id_normalized_query_place_id: {
            company_id: companyId,
            normalized_query: `place_details:${placeId}`,
            place_id: placeId,
          },
        },
        update: {
          updated_at: new Date(),
        },
        create: {
          company_id: companyId,
          normalized_query: `place_details:${placeId}`,
          place_id: placeId,
          address: suggestion.place_name,
          lat: suggestion.center[1],
          lng: suggestion.center[0],
          main_text: suggestion.name,
          secondary_text: suggestion.context?.place?.name,
        },
      });

      this.logger.log(`Saved Place Details | company: ${companyId} | placeId: ${placeId}`);
    } catch (err: any) {
      this.logger.error(`Save Place Details error: ${err.message}`);
    }
  }
}

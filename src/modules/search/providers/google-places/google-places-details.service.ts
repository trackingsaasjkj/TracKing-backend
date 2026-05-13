import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { SearchBoxSuggestion } from '../search-provider.interface';
import { GooglePlacesCacheService } from './google-places-cache.service';

const CACHE_TTL_SECONDS = 3600; // 1h

@Injectable()
export class GooglePlacesDetailsService {
  private readonly logger = new Logger(GooglePlacesDetailsService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly placesCache: GooglePlacesCacheService,
  ) {}

  /**
   * Obtiene detalles de un lugar usando Place Details API
   * Reutiliza datos cacheados si existen
   */
  async getPlaceDetails(
    placeId: string,
    companyId: string,
  ): Promise<SearchBoxSuggestion | null> {
    if (!placeId) {
      this.logger.warn('Place ID is empty');
      return null;
    }

    const cacheKey = `place:details:${placeId}`;

    // Verificar cache en memoria
    const cached = await this.cache.get<SearchBoxSuggestion>(cacheKey);
    if (cached) {
      this.logger.log(`Place Details cache hit | placeId: ${placeId}`);
      return cached;
    }

    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY not configured');
      throw new BadGatewayException('Servicio de búsqueda no configurado');
    }

    this.logger.log(`Google Place Details | placeId: ${placeId}`);

    // Places API (New) requires X-Goog-FieldMask to specify which fields to return
    const fieldMask = 'id,displayName,formattedAddress,location,types';
    const url = `https://places.googleapis.com/v1/places/${placeId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        signal: AbortSignal.timeout(10_000),
      });

      this.logger.log(`Google Place Details response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Google Place Details error: ${response.status} - ${errorText}`);
        throw new Error(`Google Place Details responded with ${response.status}`);
      }

      const data = await response.json();

      const suggestion: SearchBoxSuggestion = {
        name: data.displayName?.text || data.formattedAddress || '',
        place_name: data.formattedAddress || '',
        center: [
          data.location?.longitude || 0,
          data.location?.latitude || 0,
        ] as [number, number],
        place_type: data.types || ['place'],
        context: {
          place: { name: data.displayName?.text || '' },
          country: { name: 'Colombia' },
        },
      };

      // Guardar en cache de memoria
      await this.cache.set(cacheKey, suggestion, CACHE_TTL_SECONDS);

      // Guardar en cache de BD si tenemos coordenadas válidas
      if (data.location?.latitude && data.location?.longitude) {
        await this.placesCache.savePlaceDetails(
          companyId,
          placeId,
          suggestion,
        );
      }

      return suggestion;
    } catch (err: any) {
      this.logger.error(`Google Place Details error: ${err.message}`);
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new BadGatewayException('Timeout al comunicarse con el servicio de búsqueda');
      }
      throw new BadGatewayException('Error al comunicarse con el servicio de búsqueda');
    }
  }

  /**
   * Obtiene detalles de múltiples lugares
   */
  async getMultiplePlaceDetails(
    placeIds: string[],
    companyId: string,
  ): Promise<SearchBoxSuggestion[]> {
    const results = await Promise.all(
      placeIds.map(id => this.getPlaceDetails(id, companyId).catch(() => null)),
    );

    return results.filter((r): r is SearchBoxSuggestion => r !== null);
  }
}

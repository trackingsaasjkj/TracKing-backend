import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { RateLimitService } from '../../../../infrastructure/cache/rate-limit.service';
import { ISearchProvider, SearchBoxSuggestion, SearchOptions } from '../search-provider.interface';
import { SearchSessionService } from '../session/search-session.service';
import { GooglePlacesCacheService } from './google-places-cache.service';
import { GooglePlacesAnalyticsService } from './google-places-analytics.service';
import { UserAddressHistoryService } from '../user-address-history/user-address-history.service';

const CACHE_TTL_SECONDS = 3600; // 1h
const MIN_QUERY_LENGTH = 3; // Mínimo 3 caracteres
const RATE_LIMIT_CONFIG = { limit: 10, window: 60 }; // 10 búsquedas por minuto

@Injectable()
export class GooglePlacesService implements ISearchProvider {
  private readonly logger = new Logger(GooglePlacesService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly sessionService: SearchSessionService,
    private readonly placesCache: GooglePlacesCacheService,
    private readonly analytics: GooglePlacesAnalyticsService,
    private readonly rateLimit: RateLimitService,
    private readonly addressHistory: UserAddressHistoryService,
  ) {}

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchBoxSuggestion[]> {
    const normalized = this.normalizeQuery(query);
    const companyId = options?.companyId || 'default';
    const userId = (options as any)?.userId || 'anonymous';

    // NIVEL 3: Rate Limiting - Máximo 10 búsquedas/minuto por usuario
    try {
      const rateLimitKey = `places:${companyId}:${userId}`;
      await this.rateLimit.checkLimit(rateLimitKey, RATE_LIMIT_CONFIG);
      this.logger.log(`Rate limit OK | userId: ${userId} | company: ${companyId}`);
    } catch (err: any) {
      this.logger.warn(`Rate limit exceeded | userId: ${userId} | company: ${companyId}`);
      throw err;
    }

    // NIVEL 1: Validar mínimo de caracteres
    if (normalized.length < MIN_QUERY_LENGTH) {
      this.logger.log(`Query too short: "${normalized}" (min: ${MIN_QUERY_LENGTH})`);
      return [];
    }

    const cacheKey = `search:google:${normalized}:${options?.city || 'all'}`;

    // NIVEL 1: Verificar cache en memoria (Redis)
    const cached = await this.cache.get<SearchBoxSuggestion[]>(cacheKey);
    if (cached) {
      this.logger.log(`Memory cache hit | query: ${normalized} | city: ${options?.city || 'all'}`);
      // Registrar cache hit
      this.analytics.recordCacheHit(companyId);
      return cached;
    }

    // Registrar cache miss
    this.analytics.recordCacheMiss(companyId);
    // Registrar autocomplete request
    this.analytics.recordAutocompleteRequest(companyId);

    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY not configured');
      throw new BadGatewayException('Servicio de búsqueda no configurado');
    }

    this.logger.log(`Google Places Autocomplete | query: ${normalized} | city: ${options?.city || 'all'} | session: ${options?.sessionToken ? 'sí' : 'no'}`);

    // Get config
    const country = this.config.get<string>('GOOGLE_MAPS_COUNTRY') ?? 'co';
    const proximityLng = options?.proximity?.[0] ?? parseFloat(this.config.get<string>('GOOGLE_MAPS_PROXIMITY_LNG') ?? '-73.122742');
    const proximityLat = options?.proximity?.[1] ?? parseFloat(this.config.get<string>('GOOGLE_MAPS_PROXIMITY_LAT') ?? '7.119349');
    const limit = options?.limit ?? 5;

    // Use Google Places Autocomplete API
    const url = `https://places.googleapis.com/v1/places:autocomplete`;

    const requestBody: any = {
      input: query.trim(),
      locationBias: {
        circle: {
          center: {
            latitude: proximityLat,
            longitude: proximityLng,
          },
          radius: 50000, // 50km radius
        },
      },
      languageCode: 'es',
      regionCode: country.toUpperCase(),
    };

    // Agregar sessionToken si está disponible
    if (options?.sessionToken) {
      requestBody.sessionToken = options.sessionToken;
      this.logger.log(`Using session token: ${options.sessionToken}`);
    }

    // If city is provided, add it to the query for better filtering
    if (options?.city) {
      requestBody.input = `${query.trim()} ${options.city}`;
      this.logger.log(`Added city to query: "${requestBody.input}"`);
    }

    this.logger.debug(`Google Places URL: ${url}`);

    let data: any;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10_000),
      });

      this.logger.log(`Google Places response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Google Places error: ${response.status} - ${errorText}`);
        throw new Error(`Google Places responded with ${response.status}`);
      }

      data = await response.json();
      this.logger.log(`Google Places suggestions count: ${data.suggestions?.length || 0}`);

      // Convert Google Places response to search box format
      // Note: Google Places (New) API returns text fields as {text, matches} objects
      let suggestions: SearchBoxSuggestion[] = (data.suggestions || [])
        .slice(0, limit)
        .map((suggestion: any) => {
          const pred = suggestion.placePrediction;
          // text field is {text: string, matches: [...]} in the New API
          const fullText: string = pred?.text?.text || pred?.text || '';
          const mainText: string = pred?.mainText?.text || pred?.mainText || fullText;
          const secondaryText: string = pred?.secondaryText?.text || pred?.secondaryText || '';

          return {
            name: mainText,
            place_name: fullText,
            center: [
              pred?.location?.longitude || proximityLng,
              pred?.location?.latitude || proximityLat,
            ] as [number, number],
            place_type: ['place'],
            context: {
              place: { name: mainText },
              region: { name: secondaryText },
              country: { name: country },
            },
            place_id: pred?.placeId,
          };
        });

      // Filter by city if provided
      if (options?.city) {
        const cityLower = options.city.toLowerCase();
        suggestions = suggestions.filter(s =>
          s.place_name.toLowerCase().includes(cityLower) ||
          s.context?.place?.name?.toLowerCase().includes(cityLower)
        );
        this.logger.log(`Filtered suggestions by city "${options.city}": ${suggestions.length} results`);
      }

      // NIVEL 2: Guardar en cache de BD
      if (suggestions.length > 0) {
        await this.placesCache.saveCache(companyId, query, suggestions);
      }

      // Cache the results in memory
      await this.cache.set(cacheKey, suggestions, CACHE_TTL_SECONDS);

      return suggestions;
    } catch (err: any) {
      this.logger.error(`Google Places error: ${err.message}`);
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new BadGatewayException('Timeout al comunicarse con el servicio de búsqueda');
      }
      throw new BadGatewayException('Error al comunicarse con el servicio de búsqueda');
    }
  }

  async reverse(
    lng: number,
    lat: number,
  ): Promise<SearchBoxSuggestion | null> {
    const cacheKey = `search:google:reverse:${lng}:${lat}`;

    // Check cache first
    const cached = await this.cache.get<SearchBoxSuggestion | null>(cacheKey);
    if (cached !== undefined) {
      this.logger.log(`Cache hit | reverse: ${lat},${lng}`);
      return cached;
    }

    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY not configured');
      throw new BadGatewayException('Servicio de búsqueda no configurado');
    }

    this.logger.log(`Google Geocoding Reverse | coords: ${lat},${lng}`);

    // Use Google Geocoding API for reverse geocoding
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=es`;

    this.logger.debug(`Google Geocoding URL: ${url.replace(apiKey, '***')}`);

    let data: any;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      this.logger.log(`Google Geocoding response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Google Geocoding error: ${response.status} - ${errorText}`);
        throw new Error(`Google Geocoding responded with ${response.status}`);
      }

      data = await response.json();
    } catch (err: any) {
      this.logger.error(`Google Geocoding error: ${err.message}`);
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new BadGatewayException('Timeout al comunicarse con el servicio de búsqueda');
      }
      throw new BadGatewayException('Error al comunicarse con el servicio de búsqueda');
    }

    const result = data.results?.[0];
    const suggestion: SearchBoxSuggestion | null = result ? {
      name: result.formatted_address,
      place_name: result.formatted_address,
      center: [result.geometry.location.lng, result.geometry.location.lat] as [number, number],
      place_type: result.types || [],
      context: {
        place: { name: result.address_components?.[0]?.long_name || '' },
        country: { name: 'Colombia' },
      },
    } : null;

    // Cache the result
    await this.cache.set(cacheKey, suggestion, CACHE_TTL_SECONDS);

    return suggestion;
  }

  /**
   * Registra una dirección seleccionada en el historial del usuario
   * NIVEL 3: Historial de direcciones
   */
  async recordAddressSelection(
    userId: string,
    companyId: string,
    suggestion: SearchBoxSuggestion,
  ): Promise<void> {
    try {
      await this.addressHistory.recordAddress(userId, companyId, suggestion);
      this.logger.log(`Address recorded | userId: ${userId} | address: ${suggestion.place_name}`);
    } catch (err: any) {
      this.logger.error(`Error recording address: ${err.message}`);
    }
  }

  /**
   * Obtiene el historial de direcciones de un usuario
   * NIVEL 3: Historial de direcciones
   */
  async getUserAddressHistory(
    userId: string,
    companyId: string,
    limit: number = 10,
  ): Promise<SearchBoxSuggestion[]> {
    try {
      return await this.addressHistory.getHistory(userId, companyId, limit);
    } catch (err: any) {
      this.logger.error(`Error getting address history: ${err.message}`);
      return [];
    }
  }
}

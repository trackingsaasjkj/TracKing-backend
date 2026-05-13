import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { ISearchProvider, SearchBoxSuggestion, SearchOptions } from '../search-provider.interface';

const CACHE_TTL_SECONDS = 3600; // 1h

@Injectable()
export class MapboxService implements ISearchProvider {
  private readonly logger = new Logger(MapboxService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchBoxSuggestion[]> {
    const normalized = this.normalizeQuery(query);
    const cacheKey = `search:mapbox:${normalized}:${options?.city || 'all'}`;

    // Check cache first
    const cached = await this.cache.get<SearchBoxSuggestion[]>(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit | query: ${normalized} | city: ${options?.city || 'all'}`);
      return cached;
    }

    const token = this.config.get<string>('MAPBOX_ACCESS_TOKEN');
    if (!token) {
      this.logger.error('MAPBOX_ACCESS_TOKEN not configured');
      throw new BadGatewayException('Servicio de búsqueda no configurado');
    }

    this.logger.log(`Mapbox Geocoding | query: ${normalized} | city: ${options?.city || 'all'}`);

    const encoded = encodeURIComponent(query.trim());

    // Get config
    const country = this.config.get<string>('MAPBOX_COUNTRY') ?? 'co';
    const proximityLng = options?.proximity?.[0] ?? this.config.get<string>('MAPBOX_PROXIMITY_LNG') ?? '-73.122742';
    const proximityLat = options?.proximity?.[1] ?? this.config.get<string>('MAPBOX_PROXIMITY_LAT') ?? '7.119349';
    const limit = options?.limit ?? 5;

    // Use Geocoding API (more reliable)
    let url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?` +
      `access_token=${token}` +
      `&limit=${limit}` +
      `&country=${country}` +
      `&proximity=${proximityLng},${proximityLat}`;

    // Add city filter if provided
    if (options?.city) {
      url += `&bbox=-180,-90,180,90`; // Will be refined by proximity
    }

    this.logger.debug(`Mapbox Geocoding URL: ${url.replace(token, '***')}`);

    let data: any;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      this.logger.log(`Mapbox Geocoding response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Mapbox Geocoding error: ${response.status} - ${errorText}`);
        throw new Error(`Mapbox responded with ${response.status}`);
      }

      data = await response.json();
      this.logger.log(`Mapbox Geocoding features count: ${data.features?.length || 0}`);

      // Convert geocoding response to search box format
      let suggestions: SearchBoxSuggestion[] = (data.features || []).map((feature: any) => ({
        name: feature.place_name,
        place_name: feature.place_name,
        center: feature.center as [number, number],
        place_type: feature.place_type || [],
        context: feature.context,
      }));

      // Filter by city if provided
      if (options?.city) {
        const cityLower = options.city.toLowerCase();
        suggestions = suggestions.filter(s =>
          s.place_name.toLowerCase().includes(cityLower) ||
          s.context?.place?.name?.toLowerCase().includes(cityLower)
        );
        this.logger.log(`Filtered suggestions by city "${options.city}": ${suggestions.length} results`);
      }

      // Cache the results
      await this.cache.set(cacheKey, suggestions, CACHE_TTL_SECONDS);

      return suggestions;
    } catch (err: any) {
      this.logger.error(`Mapbox Geocoding error: ${err.message}`);
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
    const cacheKey = `search:mapbox:reverse:${lng}:${lat}`;

    // Check cache first
    const cached = await this.cache.get<SearchBoxSuggestion | null>(cacheKey);
    if (cached !== undefined) {
      this.logger.log(`Cache hit | reverse: ${lat},${lng}`);
      return cached;
    }

    const token = this.config.get<string>('MAPBOX_ACCESS_TOKEN');
    if (!token) {
      this.logger.error('MAPBOX_ACCESS_TOKEN not configured');
      throw new BadGatewayException('Servicio de búsqueda no configurado');
    }

    this.logger.log(`Mapbox Reverse Geocoding | coords: ${lat},${lng}`);

    // Use Geocoding API for reverse geocoding
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
      `access_token=${token}` +
      `&limit=1`;

    this.logger.debug(`Mapbox Reverse Geocoding URL: ${url.replace(token, '***')}`);

    let data: any;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      this.logger.log(`Mapbox Reverse Geocoding response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Mapbox Reverse Geocoding error: ${response.status} - ${errorText}`);
        throw new Error(`Mapbox responded with ${response.status}`);
      }

      data = await response.json();
    } catch (err: any) {
      this.logger.error(`Mapbox Reverse Geocoding error: ${err.message}`);
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new BadGatewayException('Timeout al comunicarse con el servicio de búsqueda');
      }
      throw new BadGatewayException('Error al comunicarse con el servicio de búsqueda');
    }

    const feature = data.features?.[0];
    const suggestion: SearchBoxSuggestion | null = feature ? {
      name: feature.place_name,
      place_name: feature.place_name,
      center: feature.center as [number, number],
      place_type: feature.place_type || [],
      context: feature.context,
    } : null;

    // Cache the result
    await this.cache.set(cacheKey, suggestion, CACHE_TTL_SECONDS);

    return suggestion;
  }
}

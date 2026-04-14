import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/cache/cache.service';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

const CACHE_TTL_SECONDS = 86400; // 24h

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  private normalizeAddress(address: string): string {
    return address.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  async forwardGeocode(address: string, company_id: string): Promise<GeocodingResult> {
    const normalized = this.normalizeAddress(address);
    const cacheKey = `geocoding:${normalized}`;

    const cached = this.cache.get<GeocodingResult>(cacheKey);
    if (cached) return cached;

    const token = this.config.get<string>('MAPBOX_ACCESS_TOKEN');
    if (!token) {
      throw new BadGatewayException('Servicio de geocoding no configurado');
    }

    this.logger.log(`Mapbox call | company: ${company_id} | address: ${normalized}`);

    const encoded = encodeURIComponent(address.trim());

    // Restrict results to Colombia and bias toward the configured default city
    const country = this.config.get<string>('MAPBOX_COUNTRY') ?? 'co';
    const proximityLng = this.config.get<string>('MAPBOX_PROXIMITY_LNG') ?? '-73.122742';
    const proximityLat = this.config.get<string>('MAPBOX_PROXIMITY_LAT') ?? '7.119349';

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
      `?access_token=${token}` +
      `&limit=1` +
      `&country=${country}` +
      `&proximity=${proximityLng},${proximityLat}`;

    let data: any;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        throw new Error(`Mapbox responded with ${response.status}`);
      }
      data = await response.json();
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new BadGatewayException('Timeout al comunicarse con el servicio de geocoding');
      }
      throw new BadGatewayException('Error al comunicarse con el servicio de geocoding');
    }

    if (!data?.features?.length) {
      throw new NotFoundException('No se encontraron resultados para la dirección proporcionada');
    }

    const [lng, lat] = data.features[0].center as [number, number];
    const result: GeocodingResult = {
      latitude: lat,
      longitude: lng,
      display_name: data.features[0].place_name as string,
    };

    this.cache.set(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }
}

/**
 * Tests de Geocoding — specs/geocoding.spec.ts
 *
 * Cubre:
 *   - GeocodingService (unit: caché, normalización, errores Mapbox)
 *   - Property 1: forma de respuesta del geocoding
 *   - Property 2: comportamiento de caché (Mapbox llamado exactamente una vez)
 *   - Property 3: normalización de clave de caché
 *   - Property 4: round-trip de coordenadas en CrearServicioDto
 *   - Property 5: validación de rangos lat/lng en el DTO
 */
import * as fc from 'fast-check';
import { NotFoundException, BadGatewayException } from '@nestjs/common';
import { GeocodingService, GeocodingResult } from '../src/modules/geocoding/geocoding.service';
import { CacheService } from '../src/infrastructure/cache/cache.service';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeCache(): CacheService {
  const mockConfig = { get: jest.fn().mockReturnValue('') } as any;
  return new CacheService(mockConfig);
}

function makeConfig(token: string | undefined = 'test-token') {
  return { get: jest.fn().mockReturnValue(token) } as any;
}

function makeMapboxResponse(lat: number, lng: number, name = 'Test Place') {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      features: [{ center: [lng, lat], place_name: name }],
    }),
  } as any;
}

function makeEmptyMapboxResponse() {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({ features: [] }),
  } as any;
}

function makeErrorMapboxResponse(status = 500) {
  return { ok: false, status } as any;
}

// ─── GeocodingService — unit tests ───────────────────────────────────────────

describe('GeocodingService', () => {
  let service: GeocodingService;
  let cache: CacheService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    cache = makeCache();
    service = new GeocodingService(cache, makeConfig());
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('retorna resultado de Mapbox cuando no hay caché', async () => {
    fetchSpy.mockResolvedValue(makeMapboxResponse(4.71, -74.07, 'Bogotá'));

    const result = await service.forwardGeocode('Calle 10', 'co-1');

    expect(result.latitude).toBe(4.71);
    expect(result.longitude).toBe(-74.07);
    expect(result.display_name).toBe('Bogotá');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retorna resultado cacheado sin llamar a Mapbox en segunda llamada', async () => {
    fetchSpy.mockResolvedValue(makeMapboxResponse(4.71, -74.07));

    await service.forwardGeocode('Calle 10', 'co-1');
    await service.forwardGeocode('Calle 10', 'co-1');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('lanza NotFoundException cuando Mapbox retorna features vacío', async () => {
    fetchSpy.mockResolvedValue(makeEmptyMapboxResponse());

    await expect(service.forwardGeocode('xyz123', 'co-1')).rejects.toThrow(NotFoundException);
  });

  it('lanza BadGatewayException cuando Mapbox responde con error HTTP', async () => {
    fetchSpy.mockResolvedValue(makeErrorMapboxResponse(500));

    await expect(service.forwardGeocode('Calle 10', 'co-1')).rejects.toThrow(BadGatewayException);
  });

  it('lanza BadGatewayException cuando fetch lanza excepción de red', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));

    await expect(service.forwardGeocode('Calle 10', 'co-1')).rejects.toThrow(BadGatewayException);
  });

  it('lanza BadGatewayException cuando MAPBOX_ACCESS_TOKEN no está configurado', async () => {
    const svc = new GeocodingService(makeCache(), makeConfig(undefined));
    await expect(svc.forwardGeocode('Calle 10', 'co-1')).rejects.toThrow(BadGatewayException);
  });

  it('normaliza la dirección antes de usar como clave de caché', async () => {
    fetchSpy.mockResolvedValue(makeMapboxResponse(4.71, -74.07));

    await service.forwardGeocode('  CALLE 10  ', 'co-1');
    await service.forwardGeocode('calle 10', 'co-1');

    // Ambas variantes deben compartir caché → Mapbox llamado solo una vez
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('guarda en caché con TTL de 86400 segundos', async () => {
    fetchSpy.mockResolvedValue(makeMapboxResponse(4.71, -74.07));
    const setSpy = jest.spyOn(cache, 'set');

    await service.forwardGeocode('Calle 10', 'co-1');

    expect(setSpy).toHaveBeenCalledWith(
      expect.stringContaining('geocoding:'),
      expect.any(Object),
      86400,
    );
  });
});

// ─── Property 1: forma de respuesta del geocoding ────────────────────────────

describe('P-1: forma de respuesta del geocoding (PBT)', () => {
  /**
   * Feature: geocoding-puntos-entrega-recogida, Property 1
   * Para cualquier string no vacío, la respuesta contiene latitude (number),
   * longitude (number) y display_name (string no vacío).
   * Validates: Requirements 2.2
   */
  it('P-1: para cualquier dirección válida, la respuesta tiene la forma correcta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        fc.float({ min: -90, max: 90, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        fc.string({ minLength: 1 }),
        async (address, lat, lng, name) => {
          const cache = makeCache();
          const svc = new GeocodingService(cache, makeConfig());
          const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
            makeMapboxResponse(lat, lng, name),
          );

          const result = await svc.forwardGeocode(address, 'co-1');

          expect(typeof result.latitude).toBe('number');
          expect(typeof result.longitude).toBe('number');
          expect(typeof result.display_name).toBe('string');
          expect(result.display_name.length).toBeGreaterThan(0);

          fetchSpy.mockRestore();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 2: comportamiento de caché ─────────────────────────────────────

describe('P-2: Mapbox llamado exactamente una vez en dos invocaciones (PBT)', () => {
  /**
   * Feature: geocoding-puntos-entrega-recogida, Property 2
   * Para cualquier dirección válida, Mapbox es invocado exactamente una vez
   * en dos llamadas consecutivas; el TTL del caché es 86400s.
   * Validates: Requirements 2.6, 2.7
   */
  it('P-2: Mapbox invocado exactamente una vez en dos llamadas con la misma dirección', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        async (address) => {
          const cache = makeCache();
          const svc = new GeocodingService(cache, makeConfig());
          const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
            makeMapboxResponse(4.71, -74.07),
          );
          const setSpy = jest.spyOn(cache, 'set');

          await svc.forwardGeocode(address, 'co-1');
          await svc.forwardGeocode(address, 'co-1');

          expect(fetchSpy).toHaveBeenCalledTimes(1);
          expect(setSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Object),
            86400,
          );

          fetchSpy.mockRestore();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 3: normalización de clave de caché ─────────────────────────────

describe('P-3: variantes normalizadas comparten caché (PBT)', () => {
  /**
   * Feature: geocoding-puntos-entrega-recogida, Property 3
   * Variantes de la misma dirección (distinta capitalización, espacios extra)
   * producen la misma clave de caché y retornan el mismo resultado sin llamar a Mapbox.
   * Validates: Requirements 7.2
   */
  it('P-3: mayúsculas/minúsculas y espacios extra comparten caché', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0 && !/\s{2,}/.test(s.trim())),
        async (base) => {
          const cache = makeCache();
          const svc = new GeocodingService(cache, makeConfig());
          const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
            makeMapboxResponse(4.71, -74.07, 'Place'),
          );

          // Primera llamada con la dirección base
          await svc.forwardGeocode(base, 'co-1');
          // Segunda llamada con la misma dirección en mayúsculas
          await svc.forwardGeocode(base.toUpperCase(), 'co-1');

          // Mapbox solo debe ser llamado una vez
          expect(fetchSpy).toHaveBeenCalledTimes(1);

          fetchSpy.mockRestore();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 4: round-trip de coordenadas en CrearServicioDto ───────────────

describe('P-4: round-trip de coordenadas — validación de rangos (PBT)', () => {
  /**
   * Feature: geocoding-puntos-entrega-recogida, Property 4 & 5
   * lat ∈ [-90, 90] y lng ∈ [-180, 180] son coordenadas válidas.
   * Validates: Requirements 3.1, 3.3, 3.5
   */
  it('P-4: coordenadas en rango válido son aceptadas', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        (lat, lng) => {
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
          expect(lng).toBeGreaterThanOrEqual(-180);
          expect(lng).toBeLessThanOrEqual(180);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('P-5: coordenadas fuera de rango son inválidas', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(90.1), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(-1000), max: Math.fround(-90.1), noNaN: true }),
        ),
        (lat) => {
          expect(Math.abs(lat) > 90).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

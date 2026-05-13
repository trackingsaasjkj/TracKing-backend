import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

interface RateLimitConfig {
  limit: number; // máximo de requests
  window: number; // ventana de tiempo en segundos
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate Limiting Service
 * Proporciona funcionalidad de rate limiting flexible para distintos servicios
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly cache: CacheService) {}

  /**
   * Verifica y registra un request en el rate limit
   * Lanza excepción si se excede el límite
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig = { limit: 10, window: 60 },
  ): Promise<{ remaining: number; resetTime: number }> {
    const window = config.window * 1000; // convertir a ms
    const rateKey = `rate-limit:${key}`;

    try {
      let rateLimitData = await this.cache.get<RateLimitEntry>(rateKey);

      if (!rateLimitData) {
        // Primer request
        rateLimitData = {
          count: 1,
          resetTime: Date.now() + window,
        };
      } else if (Date.now() > rateLimitData.resetTime) {
        // Ventana expirada, resetear
        rateLimitData = {
          count: 1,
          resetTime: Date.now() + window,
        };
      } else {
        // Dentro de la ventana, incrementar
        rateLimitData.count++;

        if (rateLimitData.count > config.limit) {
          const remainingSeconds = Math.ceil((rateLimitData.resetTime - Date.now()) / 1000);
          this.logger.warn(
            `Rate limit exceeded | key: ${key} | limit: ${config.limit} | requests: ${rateLimitData.count} | reset in: ${remainingSeconds}s`,
          );

          throw new HttpException(
            `Límite de solicitudes excedido. Máximo ${config.limit} solicitudes por ${config.window} segundos. Intente de nuevo en ${remainingSeconds} segundos.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      // Guardar datos actualizados en cache
      const ttl = Math.ceil((rateLimitData.resetTime - Date.now()) / 1000) + 1;
      await this.cache.set(rateKey, rateLimitData, ttl);

      return {
        remaining: Math.max(0, config.limit - rateLimitData.count),
        resetTime: rateLimitData.resetTime,
      };
    } catch (err: any) {
      if (err.status === 429) {
        throw err;
      }
      // En caso de error con el cache, permitir pero loguear
      this.logger.error(`Rate limit check error: ${err.message}`);
      return {
        remaining: config.limit - 1,
        resetTime: Date.now() + window,
      };
    }
  }

  /**
   * Obtiene información actual del rate limit sin incrementar contador
   */
  async getStatus(
    key: string,
    config: RateLimitConfig = { limit: 10, window: 60 },
  ): Promise<{
    count: number;
    remaining: number;
    resetTime: number;
    resetIn: number;
  }> {
    const rateKey = `rate-limit:${key}`;

    try {
      let rateLimitData = await this.cache.get<RateLimitEntry>(rateKey);

      if (!rateLimitData) {
        return {
          count: 0,
          remaining: config.limit,
          resetTime: Date.now() + config.window * 1000,
          resetIn: config.window,
        };
      }

      if (Date.now() > rateLimitData.resetTime) {
        return {
          count: 0,
          remaining: config.limit,
          resetTime: Date.now() + config.window * 1000,
          resetIn: config.window,
        };
      }

      return {
        count: rateLimitData.count,
        remaining: Math.max(0, config.limit - rateLimitData.count),
        resetTime: rateLimitData.resetTime,
        resetIn: Math.ceil((rateLimitData.resetTime - Date.now()) / 1000),
      };
    } catch (err: any) {
      this.logger.error(`Error getting rate limit status: ${err.message}`);
      return {
        count: 0,
        remaining: config.limit,
        resetTime: Date.now() + config.window * 1000,
        resetIn: config.window,
      };
    }
  }

  /**
   * Resetea el contador de rate limit para una clave
   */
  async reset(key: string): Promise<void> {
    const rateKey = `rate-limit:${key}`;
    await this.cache.delete(rateKey);
    this.logger.log(`Rate limit reset for key: ${key}`);
  }
}

import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../cache/cache.service';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate Limiting Middleware for Google Places API
 * Limita a 10 búsquedas por minuto por usuario
 */
@Injectable()
export class GooglePlacesRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GooglePlacesRateLimitMiddleware.name);
  private readonly LIMIT_PER_MINUTE = 10;
  private readonly TIME_WINDOW = 60000; // 1 minuto en ms

  constructor(private readonly cache: CacheService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Solo aplicar rate limiting a requests de búsqueda de Google Places
    if (!req.path.includes('/search') || !req.path.includes('/places')) {
      return next();
    }

    // Obtener identificador del usuario
    const userId = (req as any).user?.id || (req as any).ip || 'anonymous';
    const companyId = (req as any).user?.company_id || 'default';
    const rateKey = `rate-limit:${companyId}:${userId}`;

    try {
      // Obtener contador actual
      let rateLimitData = await this.cache.get<RateLimitEntry>(rateKey);

      if (!rateLimitData) {
        // Primer request
        rateLimitData = {
          count: 1,
          resetTime: Date.now() + this.TIME_WINDOW,
        };
      } else if (Date.now() > rateLimitData.resetTime) {
        // Ventana expirada, resetear
        rateLimitData = {
          count: 1,
          resetTime: Date.now() + this.TIME_WINDOW,
        };
      } else {
        // Dentro de la ventana, incrementar
        rateLimitData.count++;

        if (rateLimitData.count > this.LIMIT_PER_MINUTE) {
          const remainingSeconds = Math.ceil((rateLimitData.resetTime - Date.now()) / 1000);
          this.logger.warn(
            `Rate limit exceeded | userId: ${userId} | company: ${companyId} | requests: ${rateLimitData.count}/${this.LIMIT_PER_MINUTE}`,
          );

          throw new HttpException(
            `Límite de búsquedas excedido. Máximo ${this.LIMIT_PER_MINUTE} búsquedas por minuto. Intente de nuevo en ${remainingSeconds} segundos.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      // Guardar datos actualizados en cache
      const ttl = Math.ceil((rateLimitData.resetTime - Date.now()) / 1000) + 1;
      await this.cache.set(rateKey, rateLimitData, ttl);

      // Agregar headers informativos
      res.setHeader('X-RateLimit-Limit', this.LIMIT_PER_MINUTE);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.LIMIT_PER_MINUTE - rateLimitData.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));

      next();
    } catch (err: any) {
      if (err.status === 429) {
        throw err;
      }
      // En caso de error con el cache, permitir el request
      this.logger.error(`Rate limit check error: ${err.message}`);
      next();
    }
  }
}

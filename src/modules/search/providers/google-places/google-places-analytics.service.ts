import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface SearchAnalyticsData {
  company_id: string;
  user_id?: string;
  requests_google: number;
  autocomplete_requests: number;
  details_requests: number;
  cache_hits: number;
  cache_miss: number;
}

@Injectable()
export class GooglePlacesAnalyticsService {
  private readonly logger = new Logger(GooglePlacesAnalyticsService.name);

  // Almacenamiento en memoria para agregación
  private analyticsBuffer = new Map<string, SearchAnalyticsData>();

  constructor(private readonly prisma: PrismaService) {
    // Guardar analytics cada 5 minutos
    setInterval(() => this.flushAnalytics(), 5 * 60 * 1000);
  }

  /**
   * Registra una búsqueda de autocomplete
   */
  recordAutocompleteRequest(companyId: string, userId?: string): void {
    const key = `${companyId}:${userId || 'anonymous'}`;
    const current = this.analyticsBuffer.get(key) || {
      company_id: companyId,
      user_id: userId,
      requests_google: 0,
      autocomplete_requests: 0,
      details_requests: 0,
      cache_hits: 0,
      cache_miss: 0,
    };

    current.autocomplete_requests++;
    current.requests_google++;
    this.analyticsBuffer.set(key, current);

    this.logger.debug(`Recorded autocomplete | company: ${companyId} | user: ${userId || 'anonymous'}`);
  }

  /**
   * Registra una búsqueda de Place Details
   */
  recordDetailsRequest(companyId: string, userId?: string): void {
    const key = `${companyId}:${userId || 'anonymous'}`;
    const current = this.analyticsBuffer.get(key) || {
      company_id: companyId,
      user_id: userId,
      requests_google: 0,
      autocomplete_requests: 0,
      details_requests: 0,
      cache_hits: 0,
      cache_miss: 0,
    };

    current.details_requests++;
    current.requests_google++;
    this.analyticsBuffer.set(key, current);

    this.logger.debug(`Recorded details request | company: ${companyId} | user: ${userId || 'anonymous'}`);
  }

  /**
   * Registra un cache hit
   */
  recordCacheHit(companyId: string, userId?: string): void {
    const key = `${companyId}:${userId || 'anonymous'}`;
    const current = this.analyticsBuffer.get(key) || {
      company_id: companyId,
      user_id: userId,
      requests_google: 0,
      autocomplete_requests: 0,
      details_requests: 0,
      cache_hits: 0,
      cache_miss: 0,
    };

    current.cache_hits++;
    this.analyticsBuffer.set(key, current);

    this.logger.debug(`Recorded cache hit | company: ${companyId} | user: ${userId || 'anonymous'}`);
  }

  /**
   * Registra un cache miss
   */
  recordCacheMiss(companyId: string, userId?: string): void {
    const key = `${companyId}:${userId || 'anonymous'}`;
    const current = this.analyticsBuffer.get(key) || {
      company_id: companyId,
      user_id: userId,
      requests_google: 0,
      autocomplete_requests: 0,
      details_requests: 0,
      cache_hits: 0,
      cache_miss: 0,
    };

    current.cache_miss++;
    this.analyticsBuffer.set(key, current);

    this.logger.debug(`Recorded cache miss | company: ${companyId} | user: ${userId || 'anonymous'}`);
  }

  /**
   * Guarda analytics en BD y limpia buffer
   */
  private async flushAnalytics(): Promise<void> {
    if (this.analyticsBuffer.size === 0) {
      return;
    }

    try {
      const entries = Array.from(this.analyticsBuffer.values());

      this.logger.log(`Flushing ${entries.length} analytics entries to database`);

      // Aquí se guardarían en BD si tuviéramos la tabla
      // Por ahora solo loguea
      for (const entry of entries) {
        this.logger.log(
          `Analytics | company: ${entry.company_id} | google_requests: ${entry.requests_google} | cache_hits: ${entry.cache_hits} | cache_miss: ${entry.cache_miss}`,
        );
      }

      // Limpiar buffer
      this.analyticsBuffer.clear();
    } catch (err: any) {
      this.logger.error(`Failed to flush analytics: ${err.message}`);
    }
  }

  /**
   * Obtiene estadísticas de una empresa
   */
  async getCompanyStats(companyId: string, days: number = 7): Promise<any> {
    try {
      // Aquí se consultaría la BD si tuviéramos la tabla
      this.logger.log(`Getting stats for company ${companyId} for last ${days} days`);

      return {
        company_id: companyId,
        period_days: days,
        total_requests: 0,
        cache_hit_rate: 0,
        estimated_savings: 0,
      };
    } catch (err: any) {
      this.logger.error(`Failed to get company stats: ${err.message}`);
      return null;
    }
  }

  /**
   * Detecta abuso (más de 100 requests/minuto)
   */
  async detectAbuse(companyId: string): Promise<boolean> {
    const key = `${companyId}:anonymous`;
    const current = this.analyticsBuffer.get(key);

    if (!current) {
      return false;
    }

    // Si hay más de 100 requests en el buffer (5 minutos), es abuso
    const requestsPerMinute = current.requests_google / 5;

    if (requestsPerMinute > 100) {
      this.logger.warn(`Potential abuse detected | company: ${companyId} | requests/min: ${requestsPerMinute}`);
      return true;
    }

    return false;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  insertedAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry>();
  private readonly MAX_ENTRIES = 500;
  private redis: Redis | null = null;
  private useRedis = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private lastErrorTime = 0;
  private errorCooldown = 30000; // 30 segundos

  constructor(private readonly config: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    try {
      const redisUrl = this.config.get<string>('REDIS_URL');
      
      // Si REDIS_URL está vacío, usar solo caché en memoria
      if (!redisUrl || redisUrl.trim() === '') {
        this.logger.log('REDIS_URL no configurado. Usando caché en memoria.');
        this.useRedis = false;
        return;
      }

      // Validar que la URL es completa
      if (!redisUrl.includes('@') && !redisUrl.includes('localhost')) {
        this.logger.warn(`REDIS_URL incompleto: ${redisUrl}`);
        this.logger.warn('Formato esperado: redis://:password@hostname:port');
        this.logger.warn('Usando caché en memoria.');
        this.useRedis = false;
        return;
      }

      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          // Evitar bucle infinito de reconexión
          if (times > this.maxConnectionAttempts) {
            this.logger.warn(`Redis: máximo de intentos de reconexión alcanzado (${times})`);
            this.useRedis = false;
            return null; // Detener intentos de reconexión
          }
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        enableOfflineQueue: false,
      });

      this.redis.on('connect', () => {
        this.useRedis = true;
        this.connectionAttempts = 0;
        this.logger.log('✅ Redis conectado exitosamente');
      });

      this.redis.on('error', (err) => {
        // Evitar spam de logs
        const now = Date.now();
        if (now - this.lastErrorTime > this.errorCooldown) {
          this.logger.warn(`⚠️  Redis error: ${err.message}`);
          this.logger.warn('Usando caché en memoria como fallback.');
          this.lastErrorTime = now;
        }
        this.useRedis = false;
        this.connectionAttempts++;
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis conexión cerrada');
        this.useRedis = false;
      });

      this.redis.on('reconnecting', () => {
        this.logger.debug(`Redis intentando reconectar (intento ${this.connectionAttempts})`);
      });
    } catch (error) {
      this.logger.warn(`No se pudo inicializar Redis: ${error}`);
      this.useRedis = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis && this.redis) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        this.logger.debug(`Error al leer de Redis: ${error}`);
        return this.getFromMemory<T>(key);
      }
    }
    return this.getFromMemory<T>(key);
  }

  private getFromMemory<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;

    if (this.useRedis && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      } catch (error) {
        this.logger.debug(`Error al escribir en Redis: ${error}`);
      }
    }

    this.setInMemory(key, value, ttlSeconds);
  }

  private setInMemory(key: string, value: unknown, ttlSeconds: number): void {
    if (this.store.size >= this.MAX_ENTRIES) {
      this.evictOldest();
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      insertedAt: Date.now(),
    });
  }

  async delete(key: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        this.logger.debug(`Error al eliminar de Redis: ${error}`);
      }
    }
    this.store.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      } catch (error) {
        this.logger.debug(`Error al eliminar por prefijo en Redis: ${error}`);
      }
    }

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  size(): number {
    return this.store.size;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.insertedAt < oldestTime) {
        oldestTime = entry.insertedAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.store.delete(oldestKey);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        this.logger.debug(`Error al cerrar Redis: ${error}`);
      }
    }
  }
}

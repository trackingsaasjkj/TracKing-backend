import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { CacheService } from './cache.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let cache: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    cache = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkLimit', () => {
    it('should allow first request and return remaining = limit - 1', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (cache.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkLimit('test-key', { limit: 10, window: 60 });

      expect(result.remaining).toBe(9);
      expect(cache.set).toHaveBeenCalled();
    });

    it('should increment counter on subsequent requests', async () => {
      const existing = { count: 3, resetTime: Date.now() + 60000 };
      (cache.get as jest.Mock).mockResolvedValue(existing);
      (cache.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkLimit('test-key', { limit: 10, window: 60 });

      expect(result.remaining).toBe(6); // 10 - 4
    });

    it('should throw HttpException 429 when limit exceeded', async () => {
      const existing = { count: 10, resetTime: Date.now() + 60000 };
      (cache.get as jest.Mock).mockResolvedValue(existing);

      await expect(
        service.checkLimit('test-key', { limit: 10, window: 60 }),
      ).rejects.toThrow(HttpException);

      try {
        await service.checkLimit('test-key', { limit: 10, window: 60 });
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should reset counter when time window has expired', async () => {
      const expired = { count: 10, resetTime: Date.now() - 1000 }; // expired
      (cache.get as jest.Mock).mockResolvedValue(expired);
      (cache.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkLimit('test-key', { limit: 10, window: 60 });

      expect(result.remaining).toBe(9); // reset to 1, remaining = 9
    });

    it('should allow request when cache throws (fail open)', async () => {
      (cache.get as jest.Mock).mockRejectedValue(new Error('Redis down'));

      const result = await service.checkLimit('test-key', { limit: 10, window: 60 });

      expect(result.remaining).toBe(9);
    });

    it('should use default config when none provided', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (cache.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkLimit('test-key');

      expect(result.remaining).toBe(9); // default limit 10
    });
  });

  describe('getStatus', () => {
    it('should return full remaining when no entry exists', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);

      const result = await service.getStatus('test-key', { limit: 10, window: 60 });

      expect(result.count).toBe(0);
      expect(result.remaining).toBe(10);
    });

    it('should return current count and remaining', async () => {
      const existing = { count: 4, resetTime: Date.now() + 30000 };
      (cache.get as jest.Mock).mockResolvedValue(existing);

      const result = await service.getStatus('test-key', { limit: 10, window: 60 });

      expect(result.count).toBe(4);
      expect(result.remaining).toBe(6);
    });

    it('should return full remaining when window expired', async () => {
      const expired = { count: 8, resetTime: Date.now() - 1000 };
      (cache.get as jest.Mock).mockResolvedValue(expired);

      const result = await service.getStatus('test-key', { limit: 10, window: 60 });

      expect(result.count).toBe(0);
      expect(result.remaining).toBe(10);
    });

    it('should return defaults on cache error', async () => {
      (cache.get as jest.Mock).mockRejectedValue(new Error('Redis down'));

      const result = await service.getStatus('test-key', { limit: 10, window: 60 });

      expect(result.count).toBe(0);
      expect(result.remaining).toBe(10);
    });
  });

  describe('reset', () => {
    it('should call cache.delete with correct key', async () => {
      (cache.delete as jest.Mock).mockResolvedValue(undefined);

      await service.reset('my-key');

      expect(cache.delete).toHaveBeenCalledWith('rate-limit:my-key');
    });
  });
});

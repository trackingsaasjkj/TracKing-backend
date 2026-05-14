import { Test, TestingModule } from '@nestjs/testing';
import { GooglePlacesAnalyticsService } from './google-places-analytics.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

describe('GooglePlacesAnalyticsService', () => {
  let service: GooglePlacesAnalyticsService;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GooglePlacesAnalyticsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GooglePlacesAnalyticsService>(GooglePlacesAnalyticsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordAutocompleteRequest', () => {
    it('should increment autocomplete and google request counters', () => {
      service.recordAutocompleteRequest('company-1');
      service.recordAutocompleteRequest('company-1');

      // Access private buffer via any cast for testing
      const buffer = (service as any).analyticsBuffer;
      const entry = buffer.get('company-1:anonymous');

      expect(entry.autocomplete_requests).toBe(2);
      expect(entry.requests_google).toBe(2);
    });

    it('should track per-user when userId provided', () => {
      service.recordAutocompleteRequest('company-1', 'user-1');

      const buffer = (service as any).analyticsBuffer;
      const entry = buffer.get('company-1:user-1');

      expect(entry.autocomplete_requests).toBe(1);
      expect(entry.user_id).toBe('user-1');
    });
  });

  describe('recordDetailsRequest', () => {
    it('should increment details and google request counters', () => {
      service.recordDetailsRequest('company-1');

      const buffer = (service as any).analyticsBuffer;
      const entry = buffer.get('company-1:anonymous');

      expect(entry.details_requests).toBe(1);
      expect(entry.requests_google).toBe(1);
    });
  });

  describe('recordCacheHit', () => {
    it('should increment cache_hits counter', () => {
      service.recordCacheHit('company-1');
      service.recordCacheHit('company-1');
      service.recordCacheHit('company-1');

      const buffer = (service as any).analyticsBuffer;
      const entry = buffer.get('company-1:anonymous');

      expect(entry.cache_hits).toBe(3);
      expect(entry.requests_google).toBe(0); // cache hits don't count as google requests
    });
  });

  describe('recordCacheMiss', () => {
    it('should increment cache_miss counter', () => {
      service.recordCacheMiss('company-1');

      const buffer = (service as any).analyticsBuffer;
      const entry = buffer.get('company-1:anonymous');

      expect(entry.cache_miss).toBe(1);
    });
  });

  describe('detectAbuse', () => {
    it('should return false when no data exists', async () => {
      const result = await service.detectAbuse('company-unknown');
      expect(result).toBe(false);
    });

    it('should return false when requests are within normal range', async () => {
      // 10 requests in buffer (5 min window) = 2/min, well below 100
      for (let i = 0; i < 10; i++) {
        service.recordAutocompleteRequest('company-1');
      }

      const result = await service.detectAbuse('company-1');
      expect(result).toBe(false);
    });

    it('should return true when requests exceed 100/min threshold', async () => {
      // 600 requests in buffer (5 min window) = 120/min, above 100
      for (let i = 0; i < 600; i++) {
        service.recordAutocompleteRequest('company-abuse');
      }

      const result = await service.detectAbuse('company-abuse');
      expect(result).toBe(true);
    });
  });

  describe('getCompanyStats', () => {
    it('should return stats object with company_id', async () => {
      const result = await service.getCompanyStats('company-1');

      expect(result).toMatchObject({
        company_id: 'company-1',
        period_days: 7,
      });
    });

    it('should accept custom days parameter', async () => {
      const result = await service.getCompanyStats('company-1', 30);

      expect(result.period_days).toBe(30);
    });
  });
});

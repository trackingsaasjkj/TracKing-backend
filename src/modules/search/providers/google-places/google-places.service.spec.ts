import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GooglePlacesService } from './google-places.service';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { RateLimitService } from '../../../../infrastructure/cache/rate-limit.service';
import { SearchSessionService } from '../session/search-session.service';
import { GooglePlacesCacheService } from './google-places-cache.service';
import { GooglePlacesAnalyticsService } from './google-places-analytics.service';
import { UserAddressHistoryService } from '../user-address-history/user-address-history.service';

const mockSuggestion = {
  name: 'Cra 27 #48-10',
  place_name: 'Cra 27 #48-10, Bucaramanga, Colombia',
  center: [-73.122742, 7.119349] as [number, number],
  place_type: ['place'],
};

describe('GooglePlacesService', () => {
  let service: GooglePlacesService;
  let cache: jest.Mocked<CacheService>;
  let rateLimit: jest.Mocked<RateLimitService>;
  let placesCache: jest.Mocked<GooglePlacesCacheService>;
  let analytics: jest.Mocked<GooglePlacesAnalyticsService>;
  let addressHistory: jest.Mocked<UserAddressHistoryService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GooglePlacesService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: RateLimitService,
          useValue: {
            checkLimit: jest.fn().mockResolvedValue({ remaining: 9, resetTime: Date.now() + 60000 }),
          },
        },
        {
          provide: SearchSessionService,
          useValue: {
            createSession: jest.fn().mockReturnValue('session-token-123'),
            endSession: jest.fn(),
          },
        },
        {
          provide: GooglePlacesCacheService,
          useValue: {
            searchCache: jest.fn().mockResolvedValue([]),
            saveCache: jest.fn().mockResolvedValue(undefined),
            savePlaceDetails: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: GooglePlacesAnalyticsService,
          useValue: {
            recordAutocompleteRequest: jest.fn(),
            recordCacheHit: jest.fn(),
            recordCacheMiss: jest.fn(),
          },
        },
        {
          provide: UserAddressHistoryService,
          useValue: {
            getHistory: jest.fn().mockResolvedValue([]),
            recordAddress: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                GOOGLE_MAPS_API_KEY: 'test-api-key',
                GOOGLE_MAPS_COUNTRY: 'co',
                GOOGLE_MAPS_PROXIMITY_LNG: '-73.122742',
                GOOGLE_MAPS_PROXIMITY_LAT: '7.119349',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GooglePlacesService>(GooglePlacesService);
    cache = module.get(CacheService);
    rateLimit = module.get(RateLimitService);
    placesCache = module.get(GooglePlacesCacheService);
    analytics = module.get(GooglePlacesAnalyticsService);
    addressHistory = module.get(UserAddressHistoryService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return empty array for queries shorter than 3 chars', async () => {
      const result = await service.search('ab', { companyId: 'company-1' });
      expect(result).toEqual([]);
    });

    it('should return cached results from Redis when available', async () => {
      (cache.get as jest.Mock).mockResolvedValue([mockSuggestion]);

      const result = await service.search('cra 27', { companyId: 'company-1' });

      expect(result).toEqual([mockSuggestion]);
      expect(analytics.recordCacheHit).toHaveBeenCalledWith('company-1');
    });

    it('should throw HttpException 429 when rate limit exceeded', async () => {
      (rateLimit.checkLimit as jest.Mock).mockRejectedValue(
        new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );

      await expect(service.search('cra 27', { companyId: 'company-1' })).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw BadGatewayException when API key is missing', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(service.search('cra 27', { companyId: 'company-1' })).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('should record cache miss when not in Redis', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (configService.get as jest.Mock).mockReturnValue(undefined);

      try {
        await service.search('cra 27', { companyId: 'company-1' });
      } catch {
        // expected
      }

      expect(analytics.recordCacheMiss).toHaveBeenCalledWith('company-1');
      expect(analytics.recordAutocompleteRequest).toHaveBeenCalledWith('company-1');
    });

    it('should normalize query before cache lookup', async () => {
      (cache.get as jest.Mock).mockResolvedValue([mockSuggestion]);

      await service.search('  CRA 27  ', { companyId: 'company-1' });

      expect(cache.get).toHaveBeenCalledWith('search:google:cra 27:all');
    });

    it('should throw BadGatewayException when Google returns 403', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (cache.set as jest.Mock).mockResolvedValue(undefined);

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '{"error":{"code":403}}',
      } as any);

      await expect(service.search('cra 27', { companyId: 'company-1' })).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('should throw BadGatewayException when fetch fails with network error', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.search('cra 27', { companyId: 'company-1' })).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('reverse', () => {
    it('should return cached result when available', async () => {
      (cache.get as jest.Mock).mockResolvedValue(mockSuggestion);

      const result = await service.reverse(-73.122742, 7.119349);

      expect(result).toEqual(mockSuggestion);
    });

    it('should throw BadGatewayException when API key is missing', async () => {
      (cache.get as jest.Mock).mockResolvedValue(undefined);
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(service.reverse(-73.122742, 7.119349)).rejects.toThrow(BadGatewayException);
    });
  });

  describe('recordAddressSelection', () => {
    it('should call addressHistory.recordAddress', async () => {
      await service.recordAddressSelection('user-1', 'company-1', mockSuggestion);

      expect(addressHistory.recordAddress).toHaveBeenCalledWith('user-1', 'company-1', mockSuggestion);
    });

    it('should not throw when addressHistory throws', async () => {
      (addressHistory.recordAddress as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        service.recordAddressSelection('user-1', 'company-1', mockSuggestion),
      ).resolves.not.toThrow();
    });
  });

  describe('getUserAddressHistory', () => {
    it('should return history from addressHistory service', async () => {
      (addressHistory.getHistory as jest.Mock).mockResolvedValue([mockSuggestion]);

      const result = await service.getUserAddressHistory('user-1', 'company-1');

      expect(result).toEqual([mockSuggestion]);
      expect(addressHistory.getHistory).toHaveBeenCalledWith('user-1', 'company-1', 10);
    });

    it('should return empty array when addressHistory throws', async () => {
      (addressHistory.getHistory as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await service.getUserAddressHistory('user-1', 'company-1');

      expect(result).toEqual([]);
    });

    it('should pass custom limit', async () => {
      (addressHistory.getHistory as jest.Mock).mockResolvedValue([]);

      await service.getUserAddressHistory('user-1', 'company-1', 5);

      expect(addressHistory.getHistory).toHaveBeenCalledWith('user-1', 'company-1', 5);
    });
  });
});

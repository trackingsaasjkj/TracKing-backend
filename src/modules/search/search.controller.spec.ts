import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { GlobalSearchUseCase } from './application/use-cases/global-search.use-case';
import { SearchSessionService } from './providers/session/search-session.service';
import { GooglePlacesService } from './providers/google-places/google-places.service';
import { GooglePlacesDetailsService } from './providers/google-places/google-places-details.service';
import { JwtPayload } from '../../core/types/jwt-payload.type';
import { Role } from '../../core/constants/roles.enum';

const mockUser: JwtPayload = {
  sub: 'user-uuid',
  email: 'admin@test.com',
  role: Role.ADMIN,
  company_id: 'company-uuid',
};

const mockSuggestion = {
  name: 'Cra 27 #48-10',
  place_name: 'Cra 27 #48-10, Bucaramanga, Colombia',
  center: [-73.122742, 7.119349] as [number, number],
  place_type: ['place'],
};

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: jest.Mocked<SearchService>;
  let sessionService: jest.Mocked<SearchSessionService>;
  let googlePlacesService: jest.Mocked<GooglePlacesService>;
  let googlePlacesDetailsService: jest.Mocked<GooglePlacesDetailsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: {
            search: jest.fn().mockResolvedValue([mockSuggestion]),
            reverse: jest.fn().mockResolvedValue(mockSuggestion),
          },
        },
        {
          provide: GlobalSearchUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ customers: [], couriers: [], users: [], services: [] }),
          },
        },
        {
          provide: SearchSessionService,
          useValue: {
            createSession: jest.fn().mockReturnValue('session-token-abc'),
            endSession: jest.fn(),
          },
        },
        {
          provide: GooglePlacesService,
          useValue: {
            getUserAddressHistory: jest.fn().mockResolvedValue([mockSuggestion]),
            recordAddressSelection: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: GooglePlacesDetailsService,
          useValue: {
            getPlaceDetails: jest.fn().mockResolvedValue(mockSuggestion),
          },
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    searchService = module.get(SearchService);
    sessionService = module.get(SearchSessionService);
    googlePlacesService = module.get(GooglePlacesService);
    googlePlacesDetailsService = module.get(GooglePlacesDetailsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createSession', () => {
    it('should return a session token', async () => {
      const result = await controller.createSession(mockUser);
      expect(result).toMatchObject({ data: { sessionToken: 'session-token-abc' } });
    });
  });

  describe('endSession', () => {
    it('should call sessionService.endSession', async () => {
      await controller.endSession({ sessionToken: 'token-123' });
      expect(sessionService.endSession).toHaveBeenCalledWith('token-123');
    });
  });

  describe('globalSearch', () => {
    it('should return empty results for short queries', async () => {
      const result = await controller.globalSearch('a', mockUser);
      expect(result).toMatchObject({ data: { customers: [], couriers: [], users: [], services: [] } });
    });

    it('should call globalSearchUseCase for valid queries', async () => {
      const result = await controller.globalSearch('juan', mockUser);
      expect(result.data).toBeDefined();
    });
  });

  describe('forward', () => {
    it('should return suggestions from searchService', async () => {
      const result = await controller.forward(
        { query: 'cra 27', city: 'Bucaramanga', sessionToken: 'tok' },
        undefined,
        mockUser,
      );

      expect(result).toMatchObject({ data: [mockSuggestion] });
      expect(searchService.search).toHaveBeenCalledWith(
        'cra 27',
        'company-uuid',
        expect.objectContaining({ limit: 5, city: 'Bucaramanga', sessionToken: 'tok' }),
      );
    });

    it('should use limit from query param when provided', async () => {
      await controller.forward({ query: 'cra 27' }, '3', mockUser);

      expect(searchService.search).toHaveBeenCalledWith(
        'cra 27',
        'company-uuid',
        expect.objectContaining({ limit: 3 }),
      );
    });
  });

  describe('reverse', () => {
    it('should return suggestion from searchService', async () => {
      const result = await controller.reverse({ lng: -73.122742, lat: 7.119349 }, mockUser);

      expect(result).toMatchObject({ data: mockSuggestion });
      expect(searchService.reverse).toHaveBeenCalledWith(-73.122742, 7.119349, 'company-uuid');
    });
  });

  describe('getAddressHistory', () => {
    it('should return address history for current user', async () => {
      const result = await controller.getAddressHistory(mockUser);

      expect(result).toMatchObject({ data: [mockSuggestion] });
      expect(googlePlacesService.getUserAddressHistory).toHaveBeenCalledWith(
        'user-uuid',
        'company-uuid',
        10,
      );
    });

    it('should use custom limit when provided', async () => {
      await controller.getAddressHistory(mockUser, '5');

      expect(googlePlacesService.getUserAddressHistory).toHaveBeenCalledWith(
        'user-uuid',
        'company-uuid',
        5,
      );
    });
  });

  describe('recordAddressSelection', () => {
    it('should record address selection for current user', async () => {
      const result = await controller.recordAddressSelection(mockUser, mockSuggestion);

      expect(result).toMatchObject({ data: { recorded: true } });
      expect(googlePlacesService.recordAddressSelection).toHaveBeenCalledWith(
        'user-uuid',
        'company-uuid',
        mockSuggestion,
      );
    });
  });

  describe('getPlaceDetails', () => {
    it('should return place details with real coordinates', async () => {
      const result = await controller.getPlaceDetails({ placeId: 'ChIJabc123' }, mockUser);

      expect(result).toMatchObject({ data: mockSuggestion });
      expect(googlePlacesDetailsService.getPlaceDetails).toHaveBeenCalledWith(
        'ChIJabc123',
        'company-uuid',
      );
    });
  });
});

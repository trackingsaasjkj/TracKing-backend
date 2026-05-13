import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { GooglePlacesService } from './providers/google-places/google-places.service';
import { MapboxService } from './providers/mapbox/mapbox.service';

describe('SearchService - Provider Selection', () => {
  let service: SearchService;
  let googlePlaces: GooglePlacesService;
  let mapbox: MapboxService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: GooglePlacesService,
          useValue: {
            search: jest.fn(),
            reverse: jest.fn(),
          },
        },
        {
          provide: MapboxService,
          useValue: {
            search: jest.fn(),
            reverse: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SEARCH_PROVIDER') return 'google';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    googlePlaces = module.get<GooglePlacesService>(GooglePlacesService);
    mapbox = module.get<MapboxService>(MapboxService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should use Google Places when SEARCH_PROVIDER is google', async () => {
    const mockSuggestions = [
      {
        name: 'Test Place',
        place_name: 'Test Place, Colombia',
        center: [-73.122742, 7.119349],
        place_type: ['place'],
      },
    ];

    (googlePlaces.search as jest.Mock).mockResolvedValue(mockSuggestions);

    const result = await service.search('test', 'company-1');

    expect(googlePlaces.search).toHaveBeenCalledWith('test', undefined);
    expect(result).toEqual(mockSuggestions);
  });

  it('should use Mapbox when SEARCH_PROVIDER is mapbox', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'SEARCH_PROVIDER') return 'mapbox';
      return undefined;
    });

    // Reinitialize service to pick up new config
    const newService = new SearchService(googlePlaces, mapbox, configService);

    const mockSuggestions = [
      {
        name: 'Test Place',
        place_name: 'Test Place, Colombia',
        center: [-73.122742, 7.119349],
        place_type: ['place'],
      },
    ];

    (mapbox.search as jest.Mock).mockResolvedValue(mockSuggestions);

    const result = await newService.search('test', 'company-1');

    expect(mapbox.search).toHaveBeenCalledWith('test', undefined);
    expect(result).toEqual(mockSuggestions);
  });

  it('should call reverse on the correct provider', async () => {
    const mockSuggestion = {
      name: 'Test Address',
      place_name: 'Test Address, Colombia',
      center: [-73.122742, 7.119349],
      place_type: ['address'],
    };

    (googlePlaces.reverse as jest.Mock).mockResolvedValue(mockSuggestion);

    const result = await service.reverse(-73.122742, 7.119349, 'company-1');

    expect(googlePlaces.reverse).toHaveBeenCalledWith(-73.122742, 7.119349);
    expect(result).toEqual(mockSuggestion);
  });
});

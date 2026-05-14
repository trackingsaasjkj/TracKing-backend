import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GooglePlacesService } from './providers/google-places/google-places.service';
import { MapboxService } from './providers/mapbox/mapbox.service';
import { ISearchProvider, SearchBoxSuggestion, SearchOptions } from './providers/search-provider.interface';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private provider!: ISearchProvider;

  constructor(
    private readonly googlePlaces: GooglePlacesService,
    private readonly mapbox: MapboxService,
    private readonly config: ConfigService,
  ) {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const providerName = this.config.get<string>('SEARCH_PROVIDER') || 'google';
    this.logger.log(`Initializing search provider: ${providerName}`);

    if (providerName === 'mapbox') {
      this.provider = this.mapbox;
    } else {
      this.provider = this.googlePlaces;
    }
  }

  async search(
    query: string,
    company_id: string,
    options?: SearchOptions,
  ): Promise<SearchBoxSuggestion[]> {
    this.logger.log(`Search | company: ${company_id} | query: ${query}`);
    return this.provider.search(query, options);
  }

  async reverse(
    lng: number,
    lat: number,
    company_id: string,
  ): Promise<SearchBoxSuggestion | null> {
    this.logger.log(`Reverse | company: ${company_id} | coords: ${lat},${lng}`);
    return this.provider.reverse(lng, lat);
  }
}

// Export interfaces for use in other modules
export { SearchBoxSuggestion, SearchOptions } from './providers/search-provider.interface';

export interface SearchOptions {
  limit?: number;
  proximity?: [number, number];
  city?: string;
  sessionToken?: string;
  companyId?: string;
}

export interface SearchBoxSuggestion {
  name: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  context?: {
    place?: { name: string };
    country?: { name: string };
  };
}

export interface ISearchProvider {
  search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchBoxSuggestion[]>;

  reverse(
    lng: number,
    lat: number,
  ): Promise<SearchBoxSuggestion | null>;
}

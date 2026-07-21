import { apiClient as api } from './api/client';

export interface UniversalSearchResult {
  places: any[];
  vendors: any[];
  reels: any[];
  creators: any[];
  events: any[];
  offers: any[];
  hiddenGems: any[];
  meta: {
    query: string;
    totalResults: number;
  };
}

export async function searchUniversal(query: string, limit: number = 20): Promise<UniversalSearchResult> {
  const response = await api.get(`/search/universal?q=${encodeURIComponent(query)}&limit=${limit}`);
  return (response.data || response) as any;
}

export async function getTrendingSearches(): Promise<{keyword: string, count: number}[]> {
  const response = await api.get('/search/trending');
  return (response.data || response) as any;
}

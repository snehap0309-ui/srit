import { apiClient } from './client';

export interface RideEstimate {
  provider: 'uber' | 'ola' | 'rapido';
  displayName: string;
  type: 'bike' | 'auto' | 'cab' | 'xl';
  estimatedPrice: number;
  priceRange: { low: number; high: number };
  currency: string;
  durationMinutes: number;
  distanceKm: number;
  deepLink: string;
}

export interface RideEstimatesResponse {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  estimates: RideEstimate[];
}

export const ridesApi = {
  getEstimates(originLat: number, originLng: number, destLat: number, destLng: number) {
    const params = new URLSearchParams();
    params.set('originLat', String(originLat));
    params.set('originLng', String(originLng));
    params.set('destLat', String(destLat));
    params.set('destLng', String(destLng));
    return apiClient.get<RideEstimatesResponse>(`/rides/estimates?${params.toString()}`);
  },
};

import { apiClient } from './client';

export interface RewardCatalogItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  pointsRequired: number;
  value: string | null;
  imageUrl: string | null;
  vendorId: string | null;
  vendorOfferId: string | null;
  isActive: boolean;
  sortOrder: number;
  vendor?: {
    id: string;
    businessName: string;
    city: string;
    imageUrl: string | null;
  } | null;
}

export interface VendorOfferItem {
  id: string;
  vendorId: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  pointsRequired: number;
  category: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  currentRedemptions: number;
  maxRedemptions: number | null;
  validTill: string | null;
  vendor: {
    id: string;
    businessName: string;
    city: string;
    state: string;
    imageUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface NearbyReward extends VendorOfferItem {
  distance: number;
}

export const rewardsApi = {
  async list(query?: {
    category?: string;
    minPoints?: string;
    maxPoints?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v));
      });
    }
    const qs = params.toString();
    return apiClient.get<RewardCatalogItem[]>(`/rewards${qs ? `?${qs}` : ''}`);
  },

  async getById(id: string) {
    return apiClient.get<RewardCatalogItem>(`/rewards/${id}`);
  },

  async listOffers(query?: {
    category?: string;
    city?: string;
    vendorId?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v));
      });
    }
    const qs = params.toString();
    return apiClient.get<VendorOfferItem[]>(`/rewards/offers${qs ? `?${qs}` : ''}`);
  },

  async getNearby(lat: number, lng: number, radiusKm?: number) {
    return apiClient.get<NearbyReward[]>(`/rewards/nearby?lat=${lat}&lng=${lng}${radiusKm ? `&radius=${radiusKm}` : ''}`);
  },
};

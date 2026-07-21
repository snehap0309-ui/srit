import { apiClient } from './client';
import { API_CONFIG } from '../../config/api';

export interface PlaceResponse {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string | null;
  latitude: number;
  longitude: number;
  category: string;
  images: string[];
  tags?: string[];
  city?: string;
  state?: string;
  country?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rating?: number;
  reviewCount?: number;
  submittedBy: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string; email: string } | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  distance?: number;
  bestTimeToVisit?: { from: string; to: string; label?: string } | null;
  bestTimeReason?: string | null;
  history?: string | null;
  recommendedDuration?: string | null;
  hasParking?: boolean;
  parkingDetails?: string | null;
  isAccessible?: boolean;
  accessibilityDetails?: string | null;
  hasWashroom?: boolean;
  isPetFriendly?: boolean;
  website?: string | null;
  emergencyContact?: string | null;
  openingHours?: any;
  ticketPrice?: any;
  thumbnail?: string | null;
  estimatedDurationMinutes?: number | null;
}

export interface CreatePlaceInput {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  category: string;
  images?: string[];
}

export interface PlaceListQuery {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  search?: string;
  city?: string;
  state?: string;
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radius?: number;
  category?: string;
  page?: number;
  limit?: number;
}

export interface ViewportQuery {
  north: number;
  south: number;
  east: number;
  west: number;
  limit?: number;
  category?: string;
}

export interface ClusterQuery {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
  zoom?: number;
}

export interface PlaceStats {
  views: number;
  likes: number;
  saves: number;
  shares: number;
  quests: number;
}

export interface MapCluster {
  latitude: number;
  longitude: number;
  count: number;
  placeIds: string[];
  categories: string[];
  label: string;
}

export const placesApi = {
  async list(query?: PlaceListQuery) {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v));
      });
    }
    const qs = params.toString();
    return apiClient.get<PlaceResponse[]>(
      `${API_CONFIG.endpoints.places.list}${qs ? `?${qs}` : ''}`,
    );
  },

  async getById(id: string) {
    const res = await apiClient.get<PlaceResponse>(
      API_CONFIG.endpoints.places.byId(id),
    );
    return res.data;
  },

  async create(input: CreatePlaceInput) {
    const res = await apiClient.post<PlaceResponse>(
      API_CONFIG.endpoints.places.list,
      input,
    );
    return res.data;
  },

  async getMine(page = 1, limit = 20) {
    return apiClient.get<PlaceResponse[]>(
      `${API_CONFIG.endpoints.places.mine}?page=${page}&limit=${limit}`,
    );
  },

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    const res = await apiClient.patch<PlaceResponse>(
      API_CONFIG.endpoints.places.status(id),
      { status },
    );
    return res.data;
  },

  async delete(id: string) {
    await apiClient.delete(API_CONFIG.endpoints.places.byId(id));
  },

  async nearby(query: NearbyQuery) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
    return apiClient.get<PlaceResponse[]>(
      `${API_CONFIG.endpoints.places.list}/nearby?${params.toString()}`,
    );
  },

  async getStats(id: string) {
    const res = await apiClient.get<PlaceStats>(
      `${API_CONFIG.endpoints.places.byId(id)}/stats`,
    );
    return res.data;
  },

  async recordStat(id: string, action: string) {
    await apiClient.post(
      `${API_CONFIG.endpoints.places.byId(id)}/stats`,
      { action },
    );
  },

  async checkIn(id: string) {
    const res = await apiClient.post<any>(
      `${API_CONFIG.endpoints.places.byId(id)}/checkin`
    );
    return res.data;
  },

  async save(id: string) {
    const res = await apiClient.post<any>(
      `${API_CONFIG.endpoints.places.byId(id)}/save`
    );
    return res.data;
  },

  async unsave(id: string) {
    const res = await apiClient.delete<any>(
      `${API_CONFIG.endpoints.places.byId(id)}/save`
    );
    return res.data;
  },

  async getSaved(page = 1, limit = 50) {
    const res = await apiClient.get<PlaceResponse[]>(
      `${API_CONFIG.endpoints.places.list}/saved?page=${page}&limit=${limit}`,
    );
    return res.data;
  },

  async viewport(query: ViewportQuery) {
    const params = new URLSearchParams();
    params.set('north', String(query.north));
    params.set('south', String(query.south));
    params.set('east', String(query.east));
    params.set('west', String(query.west));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.category && query.category !== 'all') {
      params.set('category', query.category);
    }
    const res = await apiClient.get<PlaceResponse[]>(
      `${API_CONFIG.endpoints.places.viewport}?${params.toString()}`,
    );
    return res.data;
  },

  async getClusters(query: ClusterQuery) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
    const res = await apiClient.get<MapCluster[]>(
      `${API_CONFIG.endpoints.places.list}/clusters?${params.toString()}`,
    );
    return res.data;
  },

  async getReviews(id: string) {
    const res = await apiClient.get<any[]>(
      `${API_CONFIG.endpoints.places.byId(id)}/reviews?limit=50`,
    );
    const payload = res.data as any;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  },

  async addReview(id: string, rating: number, content: string) {
    const res = await apiClient.post<any>(
      `${API_CONFIG.endpoints.places.byId(id)}/review`,
      { rating, content },
    );
    return res.data;
  },

  async getAdminPending(page = 1, limit = 50) {
    const res = await apiClient.get<PlaceResponse[]>(
      `${API_CONFIG.endpoints.places.adminPending}?page=${page}&limit=${limit}`,
    );
    return res.data;
  },

  async adminApprove(id: string) {
    const res = await apiClient.patch<PlaceResponse>(
      API_CONFIG.endpoints.places.adminApprove(id),
      {},
    );
    return res.data;
  },

  async adminReject(id: string) {
    const res = await apiClient.patch<PlaceResponse>(
      API_CONFIG.endpoints.places.adminReject(id),
      {},
    );
    return res.data;
  },

  async addImage(id: string, url: string, caption?: string, isPrimary = true) {
    const res = await apiClient.post<PlaceResponse>(
      API_CONFIG.endpoints.places.images(id),
      { url, caption, isPrimary }
    );
    return res.data;
  },

  async getNearbyVendors(id: string, radius: number = 5000) {
    const res = await apiClient.get<any[]>(
      `${API_CONFIG.endpoints.places.byId(id)}/nearby-vendors?radius=${radius}`
    );
    return res.data;
  },

  async markReviewHelpful(placeId: string, reviewId: string) {
    const res = await apiClient.post<any>(
      `${API_CONFIG.endpoints.places.byId(placeId)}/reviews/${reviewId}/helpful`
    );
    return res.data;
  },
};

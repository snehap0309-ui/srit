import client from "./client";
import type { PaginatedResponse, SingleResponse } from "@/types";

export interface AdminReel {
  id: string;
  creatorId: string;
  videoUrl: string;
  thumbnail: string | null;
  title: string | null;
  description: string | null;
  likes: number;
  views: number;
  shares: number;
  saves: number;
  featured: boolean;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    avatar: string | null;
  };
  place?: {
    id: string;
    name: string;
  } | null;
}

export async function getReels(params?: { page?: number; limit?: number; category?: string }): Promise<PaginatedResponse<AdminReel>> {
  const res = await client.get<PaginatedResponse<AdminReel>>("/social/reels", {
    params: { ...params, limit: params?.limit ?? 15 },
  });
  return res.data;
}

export async function deleteReel(id: string): Promise<void> {
  await client.delete(`/social/admin/reels/${id}`);
}

export async function toggleFeatureReel(id: string, featured: boolean): Promise<AdminReel> {
  const res = await client.patch<SingleResponse<AdminReel>>(`/social/admin/reels/${id}/feature`, { featured });
  return res.data.data;
}

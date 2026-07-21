import client from "./client";
import type { PaginatedResponse } from "@/types";

export interface HiddenGemSubmission {
  id: string;
  userId: string;
  userName: string;
  placeName: string;
  category: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  imageUri: string | null;
  description: string;
  status: string;
  submittedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  rejectionReason?: string;
  bestTimeToVisit?: string | { from: string; to: string; label?: string } | null;
}

export async function getHiddenGems(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResponse<HiddenGemSubmission>> {
  const res = await client.get<PaginatedResponse<HiddenGemSubmission>>("/hidden-gems", { params });
  return res.data;
}

export async function approveHiddenGem(id: string, points?: number): Promise<void> {
  await client.patch(`/admin/hidden-gems/${id}/approve`, { points });
}

export async function rejectHiddenGem(id: string, reason?: string): Promise<void> {
  await client.patch(`/admin/hidden-gems/${id}/reject`, { reason });
}

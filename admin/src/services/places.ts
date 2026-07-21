import client from "./client";
import type { Place, PlaceFormData, PaginatedResponse, SingleResponse } from "@/types";

export async function getPlaces(params?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  search?: string;
  state?: string;
  city?: string;
}): Promise<PaginatedResponse<Place>> {
  const res = await client.get<PaginatedResponse<Place>>("/places", { params });
  return res.data;
}

export async function getPlace(id: string): Promise<Place> {
  const res = await client.get<SingleResponse<Place>>(`/places/${id}`);
  return res.data.data;
}

export async function createPlace(data: PlaceFormData): Promise<Place> {
  const res = await client.post<SingleResponse<Place>>("/places", data);
  return res.data.data;
}

export async function updatePlace(
  id: string,
  data: Partial<PlaceFormData>
): Promise<Place> {
  const res = await client.patch<SingleResponse<Place>>(`/admin/places/${id}`, data);
  return res.data.data;
}

export async function approvePlace(id: string): Promise<Place> {
  const res = await client.patch<SingleResponse<Place>>(`/places/${id}/status`, {
    status: "APPROVED",
  });
  return res.data.data;
}

export async function rejectPlace(id: string): Promise<Place> {
  const res = await client.patch<SingleResponse<Place>>(`/places/${id}/status`, {
    status: "REJECTED",
  });
  return res.data.data;
}

export async function deletePlace(id: string): Promise<void> {
  await client.delete(`/admin/places/${id}`);
}

export async function deleteAllPlaces(): Promise<{ deletedCount: number }> {
  const res = await client.delete<{ data: { deletedCount: number } }>("/admin/places");
  return res.data.data;
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await client.post<SingleResponse<{ url: string }>>(
    "/upload/single",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data.data.url;
}

export async function importPlaces(
  places: any[],
  options?: { overwrite?: boolean; source?: string; status?: string }
): Promise<{
  total: number;
  created: number;
  skipped: number;
  errors: number;
  skippedReasons: { name: string; reason: string }[];
  errorDetails: { name: string; error: string }[];
}> {
  const res = await client.post("/admin/places/import", {
    places,
    overwrite: options?.overwrite ?? false,
    source: options?.source ?? "ADMIN",
    status: options?.status ?? "APPROVED",
  });
  return res.data.data;
}

export async function getClusters(params: {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
  zoom: number;
}): Promise<any> {
  const res = await client.get("/places/clusters", { params });
  return res.data;
}

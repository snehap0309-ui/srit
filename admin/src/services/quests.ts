import client from "./client";

export async function getQuests(params?: {
  page?: number;
  limit?: number;
  isActive?: string;
  search?: string;
}) {
  const res = await client.get("/quests", { params });
  return res.data;
}

export async function getQuest(id: string) {
  const res = await client.get(`/quests/${id}`);
  return res.data.data;
}

export async function createQuest(data: {
  title: string;
  description?: string;
  type?: string;
  rewardPoints?: number;
  placeIds?: string[];
  image?: string;
  startsAt: string;
  endsAt?: string;
}) {
  const res = await client.post("/quests", data);
  return res.data.data;
}

export async function updateQuest(id: string, data: Partial<{
  title: string;
  description: string;
  type: string;
  rewardPoints: number;
  placeIds: string[];
  image: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}>) {
  const res = await client.patch(`/quests/${id}`, data);
  return res.data.data;
}

export async function deleteQuest(id: string) {
  await client.delete(`/quests/${id}`);
}

export async function getQuestCompletions(questId: string, params?: { page?: number; limit?: number }) {
  const res = await client.get(`/quests/${questId}/completions`, { params });
  return res.data;
}

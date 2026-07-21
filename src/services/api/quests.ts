import { apiClient } from './client';

export interface Quest {
  id: string;
  title: string;
  description: string | null;
  type: 'scavenger_hunt' | 'quiz' | 'photo_challenge';
  rewardPoints: number;
  placeIds: string[];
  /** Rich checkpoint array stored as JSON on the server */
  checkpoints: ServerCheckpoint[] | null;
  image: string | null;
  city: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ServerCheckpoint {
  id: string;
  name: string;
  clue: string;
  lat: number;
  lng: number;
  /** 'gps' = GPS only (easy), 'gps_photo' = GPS + photo (medium/hard) */
  verificationMode: 'gps' | 'gps_photo';
}

export interface QuestCompletion {
  id: string;
  questId: string;
  userId: string;
  completedAt: string;
}

export interface QuestCheckpointCompletion {
  id: string;
  questId: string;
  userId: string;
  checkpointId: string;
  photoProofUrl: string | null;
  completedAt: string;
}

export interface QuestProgress {
  questId: string;
  completedCheckpoints: { checkpointId: string; completedAt: string; photoProofUrl: string | null }[];
  isQuestCompleted: boolean;
  questCompletedAt: string | null;
}

export const questsApi = {
  async listActive(params?: { page?: number; limit?: number; city?: string; difficulty?: string }) {
    let path = '/quests?isActive=true';
    if (params?.page) path += `&page=${params.page}`;
    if (params?.limit) path += `&limit=${params.limit}`;
    if (params?.city) path += `&city=${encodeURIComponent(params.city)}`;
    if (params?.difficulty) path += `&difficulty=${params.difficulty}`;
    return apiClient.get<Quest[]>(path);
  },

  async getById(id: string) {
    return apiClient.get<Quest>(`/quests/${id}`);
  },

  async complete(questId: string) {
    return apiClient.post<QuestCompletion>(`/quests/${questId}/complete`);
  },

  async getMyProgress(questId: string) {
    return apiClient.get<QuestProgress>(`/quests/${questId}/my-progress`);
  },

  async completeCheckpoint(questId: string, checkpointId: string, photoProofUrl?: string) {
    return apiClient.post<QuestCheckpointCompletion>(
      `/quests/${questId}/checkpoints/${checkpointId}/complete`,
      { photoProofUrl }
    );
  },
};

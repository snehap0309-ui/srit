import { apiClient } from './client';
import { API_CONFIG } from '../../config/api';

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export const uploadApi = {
  async uploadImage(uri: string) {
    const formData = new FormData();
    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    } as any);

    const res = await apiClient.upload<UploadResult>(
      API_CONFIG.endpoints.upload.single,
      formData,
    );
    return res.data!;
  },

  async uploadMultiple(uris: string[]) {
    const formData = new FormData();
    uris.forEach((uri, i) => {
      formData.append('images', {
        uri,
        type: 'image/jpeg',
        name: `upload_${i}.jpg`,
      } as any);
    });

    const res = await apiClient.upload<UploadResult[]>(
      API_CONFIG.endpoints.upload.multiple,
      formData,
    );
    return res.data!;
  },

  async health() {
    return apiClient.get(API_CONFIG.endpoints.health);
  },

  async uploadVideo(uri: string, _onProgress?: (progress: number) => void): Promise<UploadResult> {
    const formData = new FormData();
    const clean = uri.split('?')[0];
    const ext = clean.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    formData.append('video', {
      uri,
      type: mimeType,
      name: `reel.${ext === 'mov' ? 'mov' : 'mp4'}`,
    } as any);

    const res = await apiClient.upload<UploadResult>(
      API_CONFIG.endpoints.upload.video,
      formData,
    );
    if (!res.data?.url) {
      throw new Error(res.message || 'Video upload failed');
    }
    return res.data;
  },
};

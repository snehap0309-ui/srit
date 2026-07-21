import { uploadToCloudinary, uploadVideoToCloudinary, cloudinary, validateImageMagicBytes, validateVideoMagicBytes } from '../../config/upload';
import { ApiError } from '../../shared/utils/ApiError';

interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
}

export const uploadService = {
  async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
    if (!file) {
      throw new ApiError(400, 'No image file provided.');
    }

    if (!validateImageMagicBytes(file.buffer)) {
      throw new ApiError(400, 'Invalid image file. Only JPEG, PNG, and WebP are allowed.');
    }

    const result = await uploadToCloudinary(file.buffer, 'palsasafar/places');
    return result;
  },

  async uploadVideo(file: Express.Multer.File): Promise<UploadResult> {
    if (!file) {
      throw new ApiError(400, 'No video file provided.');
    }

    if (!validateVideoMagicBytes(file.buffer)) {
      throw new ApiError(400, 'Invalid video file. Only MP4, MOV, and WebM are allowed.');
    }

    // This offloads the compression to Cloudinary which will handle it synchronously 
    // up to 100MB limit per request (Cloudinary allows up to 100MB synchronous upload on paid plans, 
    // but typically we should chunk it for larger files. We'll use the default stream for now).
    const result = await uploadVideoToCloudinary(file.buffer, 'palsasafar/reels');
    return result;
  },

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  },
};

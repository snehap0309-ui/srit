import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Readable } from 'stream';
import { env } from './env';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

export const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for Reels
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, MOV, and WebM videos are allowed'));
    }
  },
});

export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const header = buffer.toString('hex', 0, 4).toUpperCase();
  if (header.startsWith('FFD8FF')) return true;
  if (header === '89504E47') return true;
  if (header === '52494646') return true;
  return false;
}

export function validateVideoMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  // Quicktime/MP4 usually has ftyp box at bytes 4-8: 66747970
  const boxType = buffer.toString('hex', 4, 8).toUpperCase();
  if (boxType === '66747970') return true;
  // WebM usually starts with 1A45DFA3
  const webmHeader = buffer.toString('hex', 0, 4).toUpperCase();
  if (webmHeader === '1A45DFA3') return true;
  return false;
}

export const uploadToCloudinary = (buffer: Buffer, folder: string): Promise<{ url: string; publicId: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      },
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

export const uploadVideoToCloudinary = (buffer: Buffer, folder: string): Promise<{ url: string; publicId: string; duration: number }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm'],
        transformation: [
          { width: 720, height: 1280, crop: 'limit', quality: 'auto' }, // Compress to 720p HD portrait
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Video upload failed'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          duration: result.duration || 0,
        });
      },
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

export { cloudinary };

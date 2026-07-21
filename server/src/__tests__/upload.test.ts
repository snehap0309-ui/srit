import request from 'supertest';
import { vi } from 'vitest';
import app from '../app';
import { getAuthToken } from './helpers/auth';

vi.mock('../config/upload', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    validateImageMagicBytes: vi.fn().mockReturnValue(true),
    uploadToCloudinary: vi.fn().mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/test.jpg',
      publicId: 'palsasafar/places/test',
      width: 800,
      height: 600,
    }),
  };
});

describe('Upload API', () => {
  let userToken: string;

  beforeAll(async () => {
    userToken = await getAuthToken('USER');
  });

  describe('POST /api/v1/upload/single', () => {
    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/api/v1/upload/single')
        .attach('image', Buffer.from('fake-image-data'), 'test.jpg');

      expect(res.status).toBe(401);
    });

    it('should upload a single image', async () => {
      const res = await request(app)
        .post('/api/v1/upload/single')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('image', Buffer.from('fake-image-data'), 'test.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('url');
      expect(res.body.data).toHaveProperty('publicId');
      expect(res.body.data).toHaveProperty('width');
      expect(res.body.data).toHaveProperty('height');
    });

    it('should reject when no file provided', async () => {
      const res = await request(app)
        .post('/api/v1/upload/single')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/upload/multiple', () => {
    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/api/v1/upload/multiple')
        .attach('images', Buffer.from('fake-image-data-1'), 'test1.jpg')
        .attach('images', Buffer.from('fake-image-data-2'), 'test2.jpg');

      expect(res.status).toBe(401);
    });

    it('should upload multiple images', async () => {
      const res = await request(app)
        .post('/api/v1/upload/multiple')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('images', Buffer.from('fake-image-data-1'), 'test1.jpg')
        .attach('images', Buffer.from('fake-image-data-2'), 'test2.jpg');

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0]).toHaveProperty('url');
      expect(res.body.data[1]).toHaveProperty('url');
    });

    it('should return empty array when no files provided', async () => {
      const res = await request(app)
        .post('/api/v1/upload/multiple')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('No image files provided');
    });
  });
});

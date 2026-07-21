import request from 'supertest';
import app from '../app';
import { getAuthToken } from './helpers/auth';
import { prisma } from '../config/database';

describe('Places API', () => {
  let userToken: string;
  let adminToken: string;
  let placeId: string;

  beforeAll(async () => {
    userToken = await getAuthToken('USER');
    adminToken = await getAuthToken('ADMIN');
  });

  afterAll(async () => {
    if (placeId) {
      await prisma.place.delete({ where: { id: placeId } }).catch(() => {});
    }
  });

  describe('POST /api/v1/places', () => {
    it('should create a place when authenticated', async () => {
      const res = await request(app)
        .post('/api/v1/places')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Place',
          description: 'A test place description',
          latitude: 28.6129,
          longitude: 77.2295,
          category: 'MONUMENT',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Test Place');
      expect(res.body.data.status).toBe('PENDING');
      placeId = res.body.data.id;
    });

    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/api/v1/places')
        .send({ name: 'Test', description: 'Desc', latitude: 28.6, longitude: 77.2, category: 'MONUMENT' });

      expect(res.status).toBe(401);
    });

    it('should reject invalid data', async () => {
      const res = await request(app)
        .post('/api/v1/places')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/places', () => {
    it('should list places', async () => {
      const res = await request(app).get('/api/v1/places');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PATCH /api/v1/admin/places/:id/approve', () => {
    it('should approve place as admin', async () => {
      if (!placeId) return;
      const res = await request(app)
        .patch(`/api/v1/admin/places/${placeId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
    });
  });

  describe('GET /api/v1/places/search', () => {
    it('should search places', async () => {
      const res = await request(app).get('/api/v1/places/search?q=test');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 400 for invalid geo params', async () => {
      const res = await request(app).get('/api/v1/places/search?lat=invalid&lng=0');
      expect(res.status).toBe(400);
    });

    it('should handle empty or whitespace search queries without crashing', async () => {
      const res1 = await request(app).get('/api/v1/places/search?q=');
      expect(res1.status).toBe(200);
      expect(Array.isArray(res1.body.data)).toBe(true);

      const res2 = await request(app).get('/api/v1/places/search?q=%20%20');
      expect(res2.status).toBe(200);
      expect(Array.isArray(res2.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/places/trending', () => {
    it('should return trending places', async () => {
      const res = await request(app).get('/api/v1/places/trending');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('DELETE /api/v1/places/:id', () => {
    it('should delete a place when authenticated as admin', async () => {
      const createRes = await request(app)
        .post('/api/v1/places')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Place to Delete',
          description: 'A test place description',
          latitude: 28.6129,
          longitude: 77.2295,
          category: 'MONUMENT',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
        });
      expect(createRes.status).toBe(201);
      const testPlaceId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/places/${testPlaceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(204);
    });
  });

  describe('DELETE /api/v1/admin/places/:id', () => {
    it('should delete a place as admin via admin route', async () => {
      const createRes = await request(app)
        .post('/api/v1/places')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Place to Delete Admin',
          description: 'A test place description',
          latitude: 28.6129,
          longitude: 77.2295,
          category: 'MONUMENT',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
        });
      expect(createRes.status).toBe(201);
      const testPlaceId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/admin/places/${testPlaceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(204);
    });
  });
});

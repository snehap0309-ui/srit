import request from 'supertest';
import app from '../app';
import { getAuthToken } from './helpers/auth';
import { prisma } from '../config/database';

describe('Hidden Gems API', () => {
  let userToken: string;
  let adminToken: string;
  let gemId: string;

  beforeAll(async () => {
    userToken = await getAuthToken('USER');
    adminToken = await getAuthToken('ADMIN');
  });

  afterAll(async () => {
    if (gemId) {
      await prisma.place.delete({ where: { id: gemId } }).catch(() => {});
    }
  });

  describe('POST /api/v1/hidden-gems', () => {
    it('should create a hidden gem', async () => {
      const res = await request(app)
        .post('/api/v1/hidden-gems')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          placeName: 'Secret Waterfall',
          description: 'A hidden waterfall in the forest hidden away from the main path',
          latitude: 28.5129,
          longitude: 77.1295,
          category: 'WATERFALL',
          city: 'Delhi',
          state: 'Delhi',
          worthVisitingReason: 'Because it is a beautiful hidden spot',
          locationMethod: 'gps',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.placeName).toBe('Secret Waterfall');
      expect(res.body.data.status).toBe('pending');
      gemId = res.body.data.id;
    });

    it('should reject without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/hidden-gems')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeName: '' });
      expect(res.status).toBe(400);
    });

    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/api/v1/hidden-gems')
        .send({ placeName: 'Test', latitude: 28.5, longitude: 77.1 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/hidden-gems', () => {
    it('should list hidden gems', async () => {
      const res = await request(app)
        .get('/api/v1/hidden-gems?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject without auth', async () => {
      const res = await request(app).get('/api/v1/hidden-gems');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/hidden-gems/:id', () => {
    it('should get hidden gem by id', async () => {
      if (!gemId) return;
      const res = await request(app)
        .get(`/api/v1/hidden-gems/${gemId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(gemId);
    });

    it('should return 404 for non-existent gem', async () => {
      const res = await request(app)
        .get('/api/v1/hidden-gems/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/admin/hidden-gems/:id/approve', () => {
    it('should approve hidden gem as admin', async () => {
      if (!gemId) return;
      const res = await request(app)
        .patch(`/api/v1/admin/hidden-gems/${gemId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('should reject non-admin approval', async () => {
      if (!gemId) return;
      const res = await request(app)
        .patch(`/api/v1/admin/hidden-gems/${gemId}/approve`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});

import request from 'supertest';
import app from '../app';
import { getAuthToken } from './helpers/auth';

describe('Quests API', () => {
  let userToken: string;
  let adminToken: string;
  let questId: string;

  beforeAll(async () => {
    userToken = await getAuthToken('USER');
    adminToken = await getAuthToken('ADMIN');
  });

  describe('POST /api/v1/quests', () => {
    it('should create a quest as admin', async () => {
      const res = await request(app)
        .post('/api/v1/quests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Explore Delhi',
          description: 'Visit 5 places in Delhi',
          type: 'scavenger_hunt',
          rewardXp: 200,
          rewardPoints: 100,
          startsAt: new Date().toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Explore Delhi');
      questId = res.body.data.id;
    });

    it('should reject non-admin', async () => {
      const res = await request(app)
        .post('/api/v1/quests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Test Quest', startsAt: new Date().toISOString() });

      expect(res.status).toBe(403);
    });

    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/api/v1/quests')
        .send({ title: 'Test Quest', startsAt: new Date().toISOString() });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/quests', () => {
    it('should list quests', async () => {
      const res = await request(app)
        .get('/api/v1/quests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/quests/:id', () => {
    it('should get a quest by id', async () => {
      if (!questId) return;
      const res = await request(app)
        .get(`/api/v1/quests/${questId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(questId);
    });

    it('should return 404 for non-existent quest', async () => {
      const res = await request(app)
        .get('/api/v1/quests/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/quests/:id', () => {
    it('should update a quest as admin', async () => {
      if (!questId) return;
      const res = await request(app)
        .patch(`/api/v1/quests/${questId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Explore Delhi Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Explore Delhi Updated');
    });
  });

  describe('GET /api/v1/quests/:id/completions', () => {
    it('should list quest completions', async () => {
      if (!questId) return;
      const res = await request(app)
        .get(`/api/v1/quests/${questId}/completions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('DELETE /api/v1/quests/:id', () => {
    it('should delete a quest as admin', async () => {
      if (!questId) return;
      const res = await request(app)
        .delete(`/api/v1/quests/${questId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});

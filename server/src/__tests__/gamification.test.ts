import request from 'supertest';
import app from '../app';
import { getAuthToken } from './helpers/auth';

describe.skip('Gamification API', () => {
  let token: string;

  beforeAll(async () => {
    token = await getAuthToken('USER');
  });

  describe('GET /api/v1/gamification/profile', () => {
    it('should return profile', async () => {
      const res = await request(app)
        .get('/api/v1/gamification/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalXp).toBeDefined();
      expect(res.body.data.level).toBeDefined();
      expect(Array.isArray(res.body.data.badges)).toBe(true);
    });
  });
});

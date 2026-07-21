import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { pointRulesService } from '../modules/point-rules/pointRules.service';

describe('Wallet Extension API - Games and Regional Leaderboards', () => {
  let userToken: string;
  let userId: string;
  let testPlaceId: string;
  let placeCreated = false;
  let gameRewardPoints = 20;

  beforeAll(async () => {
    await pointRulesService.seedDefaults();
    const gameRule = await pointRulesService.getPointsForAction('game_complete');
    gameRewardPoints = gameRule?.points ?? 20;
    // 1. Authenticate or retrieve user credentials
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@palsafar.com', password: 'User@123' });
    
    userToken = loginRes.body.data.accessToken;
    userId = loginRes.body.data.user.id;

    // 2. Fetch a test place in Jabalpur
    let place = await prisma.place.findFirst({
      where: { city: { equals: 'Jabalpur', mode: 'insensitive' } },
    });

    if (!place) {
      // Create a test place in Jabalpur if none exists
      place = await prisma.place.create({
        data: {
          name: 'Test Marble Rocks Jabalpur',
          description: 'Beautiful marble cliffs',
          category: 'nature',
          address: 'Bhedaghat, Jabalpur',
          city: 'Jabalpur',
          state: 'Madhya Pradesh',
          latitude: 23.1284,
          longitude: 79.8161,
        },
      });
      placeCreated = true;
    }
    testPlaceId = place.id;
  });

  afterAll(async () => {
    // Clean up test check-ins
    await prisma.checkIn.deleteMany({
      where: { userId, placeId: testPlaceId }
    }).catch(() => {});

    // Clean up created test place
    if (placeCreated && testPlaceId) {
      await prisma.place.delete({
        where: { id: testPlaceId }
      }).catch(() => {});
    }
  });

  describe('POST /api/v1/wallet/game-completion', () => {
    it('should award points on game completion and return new balance', async () => {
      // Clear recent GAME awards so the hourly rate limit does not flake across runs.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      await prisma.walletTransaction.deleteMany({
        where: { userId, referenceType: 'GAME', createdAt: { gte: oneHourAgo } },
      });

      // Get current wallet balance
      const initialWallet = await prisma.wallet.findUnique({ where: { userId } });
      const initialPoints = initialWallet?.palPoints || 0;

      const res = await request(app)
        .post('/api/v1/wallet/game-completion')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ gameName: 'Memory Match' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.palPoints).toBe(initialPoints + gameRewardPoints);

      // Verify transaction row was added to DB
      const transaction = await prisma.walletTransaction.findFirst({
        where: { userId, reason: 'game_complete' },
        orderBy: { createdAt: 'desc' },
      });
      expect(transaction).not.toBeNull();
      expect(transaction?.amount).toBe(gameRewardPoints);
    });

    it('should fail if user is not authenticated', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/game-completion')
        .send({ gameName: 'Memory Match' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/wallet/leaderboard/regional', () => {
    it('should fetch regional rankings grouped by user check-ins', async () => {
      // Create a test check-in for the user in Jabalpur to guarantee ranking data
      await prisma.checkIn.create({
        data: {
          userId,
          placeId: testPlaceId,
        },
      }).catch(() => {}); // Catch if unique check-in already exists

      const res = await request(app)
        .get('/api/v1/wallet/leaderboard/regional?city=Jabalpur')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      
      // The current user should be ranked in the results
      const myRank = res.body.data.find((item: any) => item.userId === userId);
      expect(myRank).toBeDefined();
      expect(myRank.checkInCount).toBeGreaterThanOrEqual(1);
    });
  });
});

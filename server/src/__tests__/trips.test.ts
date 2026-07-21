import request from 'supertest';
import app from '../app';
import { getAuthToken } from './helpers/auth';
import { prisma } from '../config/database';

describe('Trips / AI Itinerary API', () => {
  let userToken: string;
  let otherUserToken: string;
  let userId: string;
  let placeIds: string[] = [];
  const testCity = 'ItinTestVille';

  beforeAll(async () => {
    userToken = await getAuthToken('USER');
    otherUserToken = await getAuthToken('VENDOR');

    const user = await prisma.user.findFirst({ where: { email: 'user@palsafar.com' } });
    userId = user!.id;

    // Seed a small, deterministic cluster of approved places for a unique test city
    // so AI generation / quick-add have real candidates to work with.
    const fixtures = [
      { name: 'ItinTest Heritage Fort', category: 'fort', lat: 22.0, lng: 79.0, rating: 4.6, fee: 50, tags: ['heritage'] },
      { name: 'ItinTest Old Temple', category: 'temple', lat: 22.01, lng: 79.01, rating: 4.2, fee: null, tags: ['heritage', 'temples'] },
      { name: 'ItinTest Waterfall', category: 'waterfall', lat: 22.05, lng: 79.05, rating: 4.8, fee: null, tags: ['nature'] },
      { name: 'ItinTest Bazaar', category: 'market', lat: 22.02, lng: 79.02, rating: 4.0, fee: null, tags: ['shopping', 'food'] },
      { name: 'ItinTest Museum', category: 'museum', lat: 22.03, lng: 79.03, rating: 4.3, fee: 500, tags: ['heritage'] },
      { name: 'ItinTest Lakeview', category: 'lake', lat: 22.04, lng: 79.04, rating: 4.1, fee: null, tags: ['nature'] },
    ];

    const created = await Promise.all(
      fixtures.map((f) =>
        prisma.place.create({
          data: {
            name: f.name,
            slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: `${f.name} is a test fixture place used for itinerary integration tests.`,
            category: f.category,
            tags: f.tags,
            city: testCity,
            state: 'TestState',
            country: 'India',
            latitude: f.lat,
            longitude: f.lng,
            rating: f.rating,
            reviewCount: 10,
            popularityScore: 40,
            status: 'APPROVED',
            source: 'ADMIN',
            ticketPrice: f.fee !== null ? { currency: 'INR', adult: f.fee } : undefined,
          },
        })
      )
    );
    placeIds = created.map((p) => p.id);
  });

  afterAll(async () => {
    // Clean up everything created for this test suite, in FK-safe order.
    await prisma.aiGenerationLog.deleteMany({ where: { userId } });
    const trips = await prisma.tripPlan.findMany({ where: { userId, destination: { contains: 'ItinTest' } }, select: { id: true } });
    const tripIds = trips.map((t) => t.id);
    if (tripIds.length) {
      await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: { in: tripIds } } } });
      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: { in: tripIds } } });
      await prisma.tripPlan.deleteMany({ where: { id: { in: tripIds } } });
    }
    await prisma.tripPlan.deleteMany({ where: { userId, destination: testCity } });
    await prisma.place.deleteMany({ where: { id: { in: placeIds } } });
  });

  describe('CRUD', () => {
    let tripId: string;

    it('creates a manual trip with day rows', async () => {
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'ItinTest Manual Trip',
          destination: testCity,
          startDate: '2026-08-01',
          endDate: '2026-08-03',
          interests: ['heritage'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.tripDays.length).toBe(3);
      tripId = res.body.data.id;
    });

    it('fetches the trip by id for the owner', async () => {
      const res = await request(app).get(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(tripId);
    });

    it('rejects access from a user who is not the owner or a collaborator', async () => {
      const res = await request(app).get(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${otherUserToken}`);
      expect(res.status).toBe(404);
    });

    it('updates trip fields and reconciles day count when the range grows', async () => {
      const res = await request(app)
        .patch(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ startDate: '2026-08-01', endDate: '2026-08-05' });

      expect(res.status).toBe(200);
      expect(res.body.data.tripDays.length).toBe(5);
    });

    it('rejects mutation attempts by a non-owner/non-collaborator', async () => {
      const res = await request(app)
        .patch(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ title: 'Hijacked' });

      expect([403, 404]).toContain(res.status);
    });

    it('duplicates a trip as a new draft', async () => {
      const res = await request(app).post(`/api/v1/trips/${tripId}/duplicate`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.id).not.toBe(tripId);

      await prisma.tripPlan.delete({ where: { id: res.body.data.id } });
    });

    it('deletes the trip', async () => {
      const res = await request(app).delete(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(204);

      const check = await request(app).get(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
      expect(check.status).toBe(404);
    });
  });

  describe('Stops: add / duplicate prevention / reorder / delete', () => {
    let tripId: string;
    let dayId: string;
    let stopId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'ItinTest Stops Trip', destination: testCity, startDate: '2026-09-01', endDate: '2026-09-01' });
      tripId = res.body.data.id;
      dayId = res.body.data.tripDays[0].id;
    });

    afterAll(async () => {
      await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: tripId } } });
      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: tripId } });
      await prisma.tripPlan.delete({ where: { id: tripId } });
    });

    it('adds a stop by place id, resolving to the real place row', async () => {
      const res = await request(app)
        .post(`/api/v1/trips/days/${dayId}/stops`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeId: placeIds[0] });

      expect(res.status).toBe(201);
      expect(res.body.data.placeId).toBe(placeIds[0]);
      stopId = res.body.data.id;
    });

    it('rejects adding the same place to the same day twice', async () => {
      const res = await request(app)
        .post(`/api/v1/trips/days/${dayId}/stops`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeId: placeIds[0] });

      expect(res.status).toBe(409);
    });

    it('adds a second stop and reorders both', async () => {
      const add = await request(app)
        .post(`/api/v1/trips/days/${dayId}/stops`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeId: placeIds[1] });
      expect(add.status).toBe(201);
      const secondStopId = add.body.data.id;

      const reorder = await request(app)
        .patch(`/api/v1/trips/days/${dayId}/stops/reorder`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ stopIds: [secondStopId, stopId] });

      expect(reorder.status).toBe(200);
      const trip = await request(app).get(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
      const stops = trip.body.data.tripDays[0].stops;
      expect(stops[0].id).toBe(secondStopId);
      expect(stops[1].id).toBe(stopId);
    });

    it('deletes a stop and compacts remaining order values', async () => {
      const res = await request(app).delete(`/api/v1/trips/stops/${stopId}`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(204);

      const trip = await request(app).get(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
      expect(trip.body.data.tripDays[0].stops.length).toBe(1);
      expect(trip.body.data.tripDays[0].stops[0].order).toBe(0);
    });

    it('rejects stop mutations from a non-collaborator', async () => {
      const res = await request(app)
        .post(`/api/v1/trips/days/${dayId}/stops`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ placeId: placeIds[2] });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Generate (schedule) & Optimize', () => {
    let tripId: string;
    let dayId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'ItinTest Generate Trip', destination: testCity, startDate: '2026-09-10', endDate: '2026-09-10' });
      tripId = res.body.data.id;
      dayId = res.body.data.tripDays[0].id;

      for (const placeId of placeIds.slice(0, 4)) {
        await request(app)
          .post(`/api/v1/trips/days/${dayId}/stops`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ placeId });
      }
    });

    afterAll(async () => {
      await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: tripId } } });
      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: tripId } });
      await prisma.tripPlan.delete({ where: { id: tripId } });
    });

    it('schedules stops with real start/end times and durations', async () => {
      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/generate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pace: 'moderate' });

      expect(res.status).toBe(200);
      const stops = res.body.data.tripDays[0].stops;
      expect(stops.length).toBeGreaterThan(0);
      for (const stop of stops) {
        expect(stop.startTime).toBeTruthy();
        expect(stop.duration).toBeGreaterThan(0);
      }
    });

    it('optimizes the route and populates distanceFromPrev', async () => {
      const res = await request(app)
        .post(`/api/v1/trips/${tripId}/optimize`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ strategy: 'shortest' });

      expect(res.status).toBe(200);
      expect(typeof res.body.data.totalDistance).toBe('number');
    });

    it('rejects generate/optimize from a non-collaborator', async () => {
      const gen = await request(app)
        .post(`/api/v1/trips/${tripId}/generate`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({});
      expect([403, 404]).toContain(gen.status);

      const opt = await request(app)
        .post(`/api/v1/trips/${tripId}/optimize`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({});
      expect([403, 404]).toContain(opt.status);
    });
  });

  describe('AI generation (POST /trips/ai-generate)', () => {
    let generatedTripId: string;

    afterAll(async () => {
      if (generatedTripId) {
        await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: generatedTripId } } });
        await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: generatedTripId } });
        await prisma.tripPlan.deleteMany({ where: { id: generatedTripId } });
      }
    });

    it('generates and persists a full itinerary for a real destination', async () => {
      const res = await request(app)
        .post('/api/v1/trips/ai-generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          destination: testCity,
          days: 2,
          pace: 'BALANCED',
          travelers: 'SOLO',
          budget: 'MEDIUM',
          interests: ['heritage', 'nature'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.trip.generationSource).toBe('AI_PROMPT');
      expect(res.body.data.trip.tripDays.length).toBe(2);
      const allStops = res.body.data.trip.tripDays.flatMap((d: any) => d.stops);
      expect(allStops.length).toBeGreaterThan(0);

      const placeIdsInPlan = allStops.map((s: any) => s.placeId);
      expect(new Set(placeIdsInPlan).size).toBe(placeIdsInPlan.length); // no duplicates anywhere in the trip

      generatedTripId = res.body.data.trip.id;
    });

    it('accepts legacy pace aliases like moderate without validation failure', async () => {
      const res = await request(app)
        .post('/api/v1/trips/ai-generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          destination: testCity,
          days: 1,
          pace: 'moderate',
          travelers: 'solo',
          budget: 'standard',
          interests: ['heritage'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.trip.pace).toBe('BALANCED');
      expect(res.body.data.trip.travelers).toBe('SOLO');
      expect(res.body.data.trip.budget).toBe('MEDIUM');

      await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: res.body.data.trip.id } } });
      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: res.body.data.trip.id } });
      await prisma.tripPlan.delete({ where: { id: res.body.data.trip.id } });
    });

    it('excludes high-fee places when budget is LOW', async () => {
      const res = await request(app)
        .post('/api/v1/trips/ai-generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination: testCity, days: 1, pace: 'QUICK', travelers: 'SOLO', budget: 'LOW', interests: [] });

      expect(res.status).toBe(201);
      const allStops = res.body.data.trip.tripDays.flatMap((d: any) => d.stops);
      const museumStop = allStops.find((s: any) => s.placeId === placeIds[4]); // ItinTest Museum, fee=500
      expect(museumStop).toBeUndefined();

      await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: res.body.data.trip.id } } });
      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: res.body.data.trip.id } });
      await prisma.tripPlan.delete({ where: { id: res.body.data.trip.id } });
    });

    it('handles an unknown destination gracefully — never a 500, never an orphaned trip on failure', async () => {
      const res = await request(app)
        .post('/api/v1/trips/ai-generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination: 'Nonexistent Place Zyxwvutsrq', days: 1, pace: 'BALANCED', travelers: 'SOLO', budget: 'MEDIUM', interests: [] });

      // Unresolved destinations must fail closed (422) — never silently fill another city's places.
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      const orphan = await prisma.tripPlan.findFirst({ where: { userId, destination: 'Nonexistent Place Zyxwvutsrq' } });
      expect(orphan).toBeNull();
    });

    it('keeps Nainital itineraries in Uttarakhand — never mixes in Bhopal/MP places', async () => {
      const res = await request(app)
        .post('/api/v1/trips/ai-generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          destination: 'Nainital',
          days: 2,
          pace: 'BALANCED',
          travelers: 'SOLO',
          budget: 'MEDIUM',
          interests: ['nature', 'heritage'],
        });

      // Thin seed coverage may still produce a valid trip (nearby Uttarakhand) or 422 if empty.
      expect([201, 422]).toContain(res.status);
      if (res.status !== 201) return;

      const trip = res.body.data.trip;
      const stops = (trip.tripDays || []).flatMap((d: any) => d.stops || []);
      expect(stops.length).toBeGreaterThan(0);

      for (const stop of stops) {
        const city = (stop.place?.city || '').toLowerCase();
        const state = (stop.place?.state || '').toLowerCase();
        expect(city).not.toContain('bhopal');
        expect(city).not.toContain('jabalpur');
        expect(city).not.toContain('indore');
        // Must stay in the hills — Uttarakhand or an empty/unknown tag still near the lake.
        if (state) {
          expect(['uttarakhand', 'uttrakhand']).toContain(state);
        }
        if (stop.place?.latitude != null && stop.place?.longitude != null) {
          const dLat = Math.abs(stop.place.latitude - 29.3919);
          const dLng = Math.abs(stop.place.longitude - 79.4542);
          expect(dLat).toBeLessThan(1.0);
          expect(dLng).toBeLessThan(1.0);
        }
      }

      await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: trip.id } } });
      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: trip.id } });
      await prisma.tripPlan.delete({ where: { id: trip.id } });
    });

    it('rejects unauthenticated generation requests', async () => {
      const res = await request(app)
        .post('/api/v1/trips/ai-generate')
        .send({ destination: testCity, days: 1, pace: 'BALANCED', travelers: 'SOLO', budget: 'MEDIUM', interests: [] });

      expect(res.status).toBe(401);
    });

    it('rejects invalid input (days out of range)', async () => {
      const res = await request(app)
        .post('/api/v1/trips/ai-generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination: testCity, days: 100, pace: 'BALANCED', travelers: 'SOLO', budget: 'MEDIUM', interests: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('Quick-add (POST /trips/quick-add)', () => {
    let quickAddTripId: string;

    afterAll(async () => {
      if (quickAddTripId) {
        await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: quickAddTripId } } });
        await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: quickAddTripId } });
        await prisma.tripPlan.deleteMany({ where: { id: quickAddTripId } });
      }
    });

    it('creates a draft trip on first quick-add and pins the stop', async () => {
      const res = await request(app)
        .post('/api/v1/trips/quick-add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeId: placeIds[0] });

      expect(res.status).toBe(201);
      expect(res.body.data.alreadyExists).toBe(false);
      expect(res.body.data.tripId).toBeTruthy();
      expect(res.body.data.stopId).toBeTruthy();
      quickAddTripId = res.body.data.tripId;

      const tripRes = await request(app)
        .get(`/api/v1/trips/${quickAddTripId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(tripRes.body.data.status).toBe('DRAFT');
      const stop = tripRes.body.data.tripDays[0].stops.find((s: any) => s.placeId === placeIds[0]);
      expect(stop).toBeDefined();
      expect(stop.isPinned).toBe(true);
    });

    it('is idempotent: re-adding the same place no-ops instead of duplicating', async () => {
      const res = await request(app)
        .post('/api/v1/trips/quick-add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeId: placeIds[0] });

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyExists).toBe(true);
      expect(res.body.data.tripId).toBe(quickAddTripId);

      const tripRes = await request(app)
        .get(`/api/v1/trips/${quickAddTripId}`)
        .set('Authorization', `Bearer ${userToken}`);
      const stops = tripRes.body.data.tripDays.flatMap((d: any) => d.stops);
      const matching = stops.filter((s: any) => s.placeId === placeIds[0]);
      expect(matching.length).toBe(1);
    });

    it('appends further quick-added places to the same active draft', async () => {
      const res = await request(app)
        .post('/api/v1/trips/quick-add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeId: placeIds[1] });

      expect(res.status).toBe(201);
      expect(res.body.data.tripId).toBe(quickAddTripId);

      const tripRes = await request(app)
        .get(`/api/v1/trips/${quickAddTripId}`)
        .set('Authorization', `Bearer ${userToken}`);
      const stops = tripRes.body.data.tripDays.flatMap((d: any) => d.stops);
      expect(stops.length).toBe(2);
    });

    it('rejects an unresolvable place id gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/trips/quick-add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ placeId: 'does-not-exist-at-all' });

      expect(res.status).toBe(404);
    });
  });

  describe('Start / Complete / Visit / Skip / Progress / History', () => {
    let tripId: string;
    const stopIds: string[] = [];

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'ItinTest Lifecycle Trip', destination: testCity, startDate: '2026-09-20', endDate: '2026-09-20' });
      tripId = res.body.data.id;
      const dayId = res.body.data.tripDays[0].id;

      for (const placeId of placeIds.slice(0, 2)) {
        const add = await request(app)
          .post(`/api/v1/trips/days/${dayId}/stops`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ placeId });
        stopIds.push(add.body.data.id);
      }
    });

    afterAll(async () => {
      await prisma.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: tripId } } });
      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: tripId } });
      await prisma.tripPlan.delete({ where: { id: tripId } });
    });

    it('rejects starting a trip with an empty itinerary', async () => {
      const empty = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'ItinTest Empty Trip', destination: testCity, startDate: '2026-09-21', endDate: '2026-09-21' });

      const res = await request(app).post(`/api/v1/trips/${empty.body.data.id}/start`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(400);

      await prisma.tripPlanDay.deleteMany({ where: { tripPlanId: empty.body.data.id } });
      await prisma.tripPlan.delete({ where: { id: empty.body.data.id } });
    });

    it('starts the trip', async () => {
      const res = await request(app).post(`/api/v1/trips/${tripId}/start`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('reports progress with the correct totals', async () => {
      const res = await request(app).get(`/api/v1/trips/${tripId}/progress`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalStops).toBe(2);
      expect(res.body.data.visitedCount).toBe(0);
    });

    it('marks the first stop visited and advances progress', async () => {
      const res = await request(app).post(`/api/v1/trips/stops/${stopIds[0]}/visit`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.visitedAt).toBeTruthy();

      const progress = await request(app).get(`/api/v1/trips/${tripId}/progress`).set('Authorization', `Bearer ${userToken}`);
      expect(progress.body.data.visitedCount).toBe(1);
    });

    it('skips the second stop and completes the trip automatically', async () => {
      const res = await request(app).post(`/api/v1/trips/stops/${stopIds[1]}/skip`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);

      const trip = await request(app).get(`/api/v1/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
      expect(trip.body.data.status).toBe('COMPLETED');
    });

    it('appears in completed trip history', async () => {
      const res = await request(app)
        .get('/api/v1/trips/history/completed')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((t: any) => t.id === tripId)).toBe(true);
    });
  });
});

import { prisma } from '../../config/database';

beforeAll(async () => {
  await prisma.$connect();
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
}, 60_000);

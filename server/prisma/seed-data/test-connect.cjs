const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('Connecting...');
  await p.$connect();
  console.log('Connected!');
  const c = await p.place.count();
  console.log('Place count:', c);
  await p.$disconnect();
  console.log('Done');
})();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({where: {email: 'shivaay@palsafar.com'}}).then(u => {
  console.log(u ? 'User exists' : 'User missing');
  return prisma.$disconnect();
});

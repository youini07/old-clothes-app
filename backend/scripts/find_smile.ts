import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    where: { name: { contains: '스마일' } }
  });
  console.log(JSON.stringify(users, null, 2));
}
main().finally(() => prisma.$disconnect());

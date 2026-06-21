import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.request.findMany();
  console.log('Requests count:', requests.length);
  console.log(JSON.stringify(requests, null, 2));
  
  const users = await prisma.user.findMany();
  console.log('Users count:', users.length);
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .then(() => prisma.$disconnect());

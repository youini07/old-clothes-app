const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const reqs = await prisma.request.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { completedDate: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(reqs, null, 2));
}
run();

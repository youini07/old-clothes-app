const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const drivers = await prisma.driverProfile.findMany({ include: { user: true }});
  console.log('--- DRIVER PROFILES ---');
  console.log(JSON.stringify(drivers, null, 2));
}
main().then(() => process.exit(0));

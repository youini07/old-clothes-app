import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const partnerId = "some-partner-id"; // We don't have this, let's just find the first driver that is NOT the partner
  const drivers = await prisma.driverProfile.findMany({ include: { user: true } });
  
  console.log(`Found ${drivers.length} drivers.`);
  for (const driver of drivers) {
    if (driver.userId !== driver.partnerId) {
      console.log(`Trying to delete driver ${driver.id} (user: ${driver.user.name})`);
      try {
        await prisma.request.updateMany({
          where: { driverId: driver.id, status: { not: 'COMPLETED' } },
          data: { driverId: null, status: 'ASSIGNED', confirmedDate: null, etaMinutes: null }
        });
        await prisma.request.updateMany({
          where: { driverId: driver.id, status: 'COMPLETED' },
          data: { driverId: null }
        });
        
        await prisma.driverProfile.delete({ where: { id: driver.id } });
        console.log(`Deleted DriverProfile ${driver.id}`);
        await prisma.user.delete({ where: { id: driver.userId } });
        console.log(`Deleted User ${driver.userId}`);
      } catch (err) {
        console.error(`Error deleting driver ${driver.id}:`, err);
      }
    }
  }
}

const run = async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
  await prisma.$disconnect();
};
run();

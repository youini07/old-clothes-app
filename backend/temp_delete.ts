import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const driverProfile = await prisma.driverProfile.findFirst();
  if (!driverProfile) {
    console.log('No driver profile found');
    return;
  }

  const driverId = driverProfile.id;
  console.log('Deleting driverId:', driverId);

  try {
    await prisma.request.updateMany({
      where: { driverId: driverId, status: { not: 'COMPLETED' } },
      data: { driverId: null, status: 'ASSIGNED', confirmedDate: null, etaMinutes: null }
    });
    
    await prisma.request.updateMany({
      where: { driverId: driverId, status: 'COMPLETED' },
      data: { driverId: null }
    });

    await prisma.driverProfile.delete({ where: { id: driverId } });
    await prisma.user.delete({ where: { id: driverProfile.userId } });

    console.log('Deleted successfully');
  } catch (err) {
    console.error('Delete error:', err);
  }
}

const run = async () => {
  await main();
  await prisma.$disconnect();
};
run();

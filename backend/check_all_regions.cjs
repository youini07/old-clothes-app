const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.request.findMany({
    select: { status: true, address: true }
  });
  
  const statuses = new Set();
  const rawAddresses = new Set();
  const parsedRegions = new Set();

  requests.forEach(r => {
    statuses.add(r.status);
    if (r.address) {
      rawAddresses.add(r.address);
      const parts = r.address.split(' ').slice(0, 3).join(' ');
      parsedRegions.add(parts);
    }
  });
  
  console.log(`Total requests in DB: ${requests.length}`);
  console.log('--- Distinct Statuses ---');
  console.log(Array.from(statuses).join(', '));
  console.log('--- Distinct Regions (All statuses) ---');
  console.log(Array.from(parsedRegions).sort().join('\n'));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

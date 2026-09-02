const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying completed requests from DB...');
  const requests = await prisma.request.findMany({
    where: { status: 'COMPLETED' },
    select: { address: true, sigungu: true, bname: true }
  });
  
  const rawAddresses = new Set();
  const parsedRegions = new Set();

  requests.forEach(r => {
    if (r.address) {
      rawAddresses.add(r.address);
      const parts = r.address.split(' ').slice(0, 3).join(' ');
      parsedRegions.add(parts);
    }
  });
  
  console.log(`Total completed requests: ${requests.length}`);
  console.log('--- Distinct Regions (First 3 parts of address) ---');
  console.log(Array.from(parsedRegions).sort().join('\n'));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

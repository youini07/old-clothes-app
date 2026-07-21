const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const maskAddress = (address) => {
  if (!address) return '';
  const parts = address.trim().split(/\s+/);
  
  const guIndex = parts.findIndex(p => p.endsWith('구'));
  if (guIndex !== -1) return parts.slice(0, guIndex + 1).join(' ');
  
  const siIndex = parts.findIndex(p => p.endsWith('시') || p.endsWith('군'));
  if (siIndex !== -1) return parts.slice(0, siIndex + 1).join(' ');
  
  return parts.slice(0, 2).join(' ');
};

async function main() {
  const posts = await prisma.boardPost.findMany({ where: { type: 'REVIEW' } });
  let updated = 0;
  for (const post of posts) {
    if (post.maskedAddress) {
      const newMasked = maskAddress(post.maskedAddress);
      if (newMasked !== post.maskedAddress) {
        await prisma.boardPost.update({ where: { id: post.id }, data: { maskedAddress: newMasked } });
        updated++;
      }
    }
  }
  console.log(`Updated ${updated} posts`);
}

main().finally(() => prisma.$disconnect());

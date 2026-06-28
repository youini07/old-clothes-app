import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'youini07@gmail.com';
  const password = await bcrypt.hash('0211love', 10);
  const name = '슈퍼관리자';

  await prisma.user.upsert({
    where: { email },
    update: { password, name, role: 'SUPER_ADMIN' },
    create: {
      email,
      password,
      name,
      role: 'SUPER_ADMIN'
    }
  });
  console.log('Super admin created');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

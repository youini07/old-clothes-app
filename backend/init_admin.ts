import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@test.com';
  const password = 'admin';
  const name = '슈퍼 오너';

  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, name, role: 'SUPER_ADMIN' },
    create: {
      email,
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN'
    }
  });

  console.log('Super Admin created successfully:', user.email);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

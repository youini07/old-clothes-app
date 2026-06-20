const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'youini07@gmail.com';
  const password = '0211love';
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
  })
  .then(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    const hashedPassword = await bcrypt.hash("0211love", 10);
    
    // Check if the old admin exists
    const existing = await prisma.user.findUnique({ where: { email: "admin@oldclothes.com" } });
    
    if (existing) {
      await prisma.user.update({
        where: { email: "admin@oldclothes.com" },
        data: {
          email: "youini07@gmail.com",
          password: hashedPassword,
          name: "슈퍼오너"
        }
      });
      console.log("Admin updated successfully!");
    } else {
      await prisma.user.upsert({
        where: { email: "youini07@gmail.com" },
        update: { password: hashedPassword, name: "슈퍼오너", role: "SUPER_ADMIN" },
        create: {
          email: "youini07@gmail.com",
          password: hashedPassword,
          name: "슈퍼오너",
          role: "SUPER_ADMIN"
        }
      });
      console.log("Admin created successfully!");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

const { Client } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("Checking database state for safe migration...");
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  
  await client.connect();

  try {
    // Check if _prisma_migrations table exists
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_prisma_migrations'
      );
    `);
    const hasMigrationsTable = res.rows[0].exists;

    if (!hasMigrationsTable) {
      // Check if User table exists
      const userRes = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'User'
        );
      `);
      const hasUserTable = userRes.rows[0].exists;

      if (hasUserTable) {
        console.log("Existing database detected without migration history. Baselining...");
        const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
        if (fs.existsSync(migrationsDir)) {
          const folders = fs.readdirSync(migrationsDir).filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory());
          
          // Find the init migration
          const initMigration = folders.find(f => f.endsWith('_init'));
          if (initMigration) {
            console.log(`Resolving initial migration: ${initMigration}`);
            execSync(`npx prisma migrate resolve --applied ${initMigration}`, { stdio: 'inherit' });
          } else {
            console.warn("No _init migration found, skipping baseline resolution.");
          }
        } else {
          console.warn("No prisma/migrations folder found, skipping baseline resolution.");
        }
      } else {
        console.log("Empty database detected. Proceeding normally.");
      }
    } else {
      console.log("Migration history found. Proceeding normally.");
    }

    console.log("Running prisma migrate deploy...");
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log("Database migration completed successfully.");
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("Migration check failed:", err);
  process.exit(1);
});

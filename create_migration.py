import os
import datetime

now = datetime.datetime.now()
folder_name = now.strftime("%Y%m%d%H%M%S") + "_add_sns_urls"
migration_dir = os.path.join('backend', 'prisma', 'migrations', folder_name)

os.makedirs(migration_dir, exist_ok=True)

sql_content = """ALTER TABLE "BoardPost" ADD COLUMN "cafeUrl1" TEXT, ADD COLUMN "cafeUrl2" TEXT, ADD COLUMN "snsUrl1" TEXT, ADD COLUMN "snsUrl2" TEXT, ADD COLUMN "snsUrl3" TEXT;"""

with open(os.path.join(migration_dir, 'migration.sql'), 'w', encoding='utf-8') as f:
    f.write(sql_content)

print(f"Migration created: {folder_name}")

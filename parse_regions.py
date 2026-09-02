import pandas as pd
import json

file_path = r"C:\Users\youin\Downloads\고객DB_2026-09-02.xlsx"

# Read Excel file
df = pd.read_excel(file_path)

# Ensure '수거 횟수' is treated as string, extract digits, and convert to int
def extract_count(val):
    try:
        if pd.isna(val):
            return 0
        import re
        m = re.search(r'\d+', str(val))
        if m:
            return int(m.group())
        return 0
    except:
        return 0

df['count'] = df['수거 횟수'].apply(extract_count)

# Filter for count >= 1
active_df = df[df['count'] >= 1]

# Extract Region
regions = {}
for address in active_df['주소']:
    if pd.isna(address):
        continue
    parts = str(address).split()
    if len(parts) >= 2:
        province = parts[0]
        city = parts[1]
        key = f"{province} {city}"
        regions[key] = regions.get(key, 0) + 1

# Sort by count descending
sorted_regions = sorted(regions.items(), key=lambda x: x[1], reverse=True)

with open('regions.json', 'w', encoding='utf-8') as f:
    json.dump(sorted_regions, f, ensure_ascii=False, indent=2)

print("Total completed addresses:", len(active_df))
print(json.dumps(sorted_regions, ensure_ascii=False, indent=2))

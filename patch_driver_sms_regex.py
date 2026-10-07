import re

file_path = 'frontend/src/pages/DriverDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace any occurrence of the old pattern
pattern = r"`\\n\\n🎁 \[사장님 이벤트\]\\n\$\{partnerEvent\.text\}`"
replacement = r"`\n\n⭐━━━━ 이벤트 안내 ━━━━⭐\n📢 [특별 이벤트 진행중!]\n\n${partnerEvent.text}\n━━━━━━━━━━━━━━━━━━`"

content = re.sub(pattern, replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Regex patch applied successfully!")

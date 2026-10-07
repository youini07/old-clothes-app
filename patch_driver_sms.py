import os

file_path = 'frontend/src/pages/DriverDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = "const eventString = partnerEvent?.isActive && partnerEvent?.text ? `\\n\\n🎁 [사장님 이벤트]\\n${partnerEvent.text}` : '';"
replacement1 = "const eventString = partnerEvent?.isActive && partnerEvent?.text ? `\\n\\n⭐━━━━ 이벤트 안내 ━━━━⭐\\n📢 [특별 이벤트 진행중!]\\n\\n${partnerEvent.text}\\n━━━━━━━━━━━━━━━━━━` : '';"

# We can also do a simple replace for the inline one:
target2 = "partnerEvent?.isActive && partnerEvent?.text ? `\\n\\n🎁 [사장님 이벤트]\\n${partnerEvent.text}` : ''"
replacement2 = "partnerEvent?.isActive && partnerEvent?.text ? `\\n\\n⭐━━━━ 이벤트 안내 ━━━━⭐\\n📢 [특별 이벤트 진행중!]\\n\\n${partnerEvent.text}\\n━━━━━━━━━━━━━━━━━━` : ''"

if target1 in content or target2 in content:
    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched event strings successfully.")
else:
    print("Targets not found!")

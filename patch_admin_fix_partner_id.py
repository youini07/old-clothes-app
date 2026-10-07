import os

file_path = 'frontend/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "const res = await axios.get(`${import.meta.env.VITE_API_URL}/board/reviews/${partnerId}/export?startDate=${reviewExtractStartDate}&endDate=${reviewExtractEndDate}`"
replacement = "const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');\n      const res = await axios.get(`${import.meta.env.VITE_API_URL}/board/reviews/${userInfo.id}/export?startDate=${reviewExtractStartDate}&endDate=${reviewExtractEndDate}`"

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed partnerId reference in AdminDashboard.tsx!")
else:
    print("Target not found.")

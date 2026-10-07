import os

file_path = r'c:\Users\youin\OneDrive\바탕 화면\헌옷수거어플\frontend\src\pages\Landing.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

res = "STATS ID FIND: " + str(content.find('id="stats"')) + "\n"
res += "AXIOS FIND: " + str(content.find('import axios')) + "\n"
res += "YOUTUBE FIND: " + str(content.find('getYoutubeEmbedUrl')) + "\n"

with open(r'c:\Users\youin\OneDrive\바탕 화면\헌옷수거어플\debug.txt', 'w', encoding='utf-8') as f:
    f.write(res)

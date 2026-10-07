import os

file_path = 'backend/prisma/schema.prisma'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "  receiptSnapshot   Json?    // 영수증 스냅샷 데이터 (금액, 수거량 등)"
replacement = """  receiptSnapshot   Json?    // 영수증 스냅샷 데이터 (금액, 수거량 등)
  
  // 홍보 링크 (이벤트 참여용)
  cafeUrl1          String?
  cafeUrl2          String?
  snsUrl1           String?
  snsUrl2           String?
  snsUrl3           String?"""

if "receiptSnapshot   Json?" in content and "cafeUrl1" not in content:
    # Need to handle possible encoding issues with comments
    import re
    content = re.sub(r'  receiptSnapshot\s+Json\?.*', replacement, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched schema.prisma successfully.")
else:
    print("Target not found or already patched.")

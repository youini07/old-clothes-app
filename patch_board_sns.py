import os
import re

file_path = 'backend/src/routes/board.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the POST /reviews to accept cafeUrl1, snsUrl1 etc.
# Find where it extracts req.body
pattern_req_body = r"""    const {
      requestId,       // 수거 신청 ID (필수)
      ratingConvenience,
      ratingKindness,
      ratingSpeed,
      content,         // 내용
    } = req\.body;"""

replacement_req_body = """    const {
      requestId,
      ratingConvenience,
      ratingKindness,
      ratingSpeed,
      content,
      cafeUrl1,
      cafeUrl2,
      snsUrl1,
      snsUrl2,
      snsUrl3
    } = req.body;"""

content = re.sub(pattern_req_body, replacement_req_body, content)

# Find prisma.boardPost.create
pattern_create = r"""      data: {
        type: 'REVIEW',
        title: `\[\$\{request\.name\} 고객님 후기\]`,
        content: content \|\| '',
        authorName: maskedName,
        partnerId: request\.partnerId,
        requestId: requestId,
        ratingConvenience,
        ratingKindness,
        ratingSpeed,
        maskedPhone,
        maskedAddress,
        receiptSnapshot: request\.receiptSnapshot || undefined
      }"""

replacement_create = """      data: {
        type: 'REVIEW',
        title: `[${request.name} 고객님 후기]`,
        content: content || '',
        authorName: maskedName,
        partnerId: request.partnerId,
        requestId: requestId,
        ratingConvenience,
        ratingKindness,
        ratingSpeed,
        maskedPhone,
        maskedAddress,
        receiptSnapshot: request.receiptSnapshot || undefined,
        cafeUrl1,
        cafeUrl2,
        snsUrl1,
        snsUrl2,
        snsUrl3
      }"""

content = content.replace(pattern_create.replace('\\', ''), replacement_create)
# Alternatively, regex for the create block just in case:
if "cafeUrl1" not in content[content.find("data: {"):]:
    content = re.sub(
        r"receiptSnapshot: request\.receiptSnapshot \|\| undefined\s*}", 
        "receiptSnapshot: request.receiptSnapshot || undefined,\n        cafeUrl1,\n        cafeUrl2,\n        snsUrl1,\n        snsUrl2,\n        snsUrl3\n      }", 
        content
    )


# 2. Add a new route for PATCH /reviews/by-request/:requestId/sns-links
new_route = """
// 리뷰 SNS 링크 수정 (고객용 - requestId 기반)
router.patch('/reviews/by-request/:requestId/sns-links', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { cafeUrl1, cafeUrl2, snsUrl1, snsUrl2, snsUrl3 } = req.body;

    const review = await prisma.boardPost.findFirst({
      where: { type: 'REVIEW', requestId }
    });

    if (!review) {
      return res.status(404).json({ error: '해당 수거 내역에 대한 리뷰를 찾을 수 없습니다.' });
    }

    const updated = await prisma.boardPost.update({
      where: { id: review.id },
      data: {
        cafeUrl1, cafeUrl2, snsUrl1, snsUrl2, snsUrl3
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('리뷰 SNS 링크 수정 실패:', error);
    res.status(500).json({ error: '링크 수정 중 오류가 발생했습니다.' });
  }
});
"""

# Append before `export default router;`
if "sns-links" not in content:
    content = content.replace("export default router;", new_route + "\nexport default router;")


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched board.ts successfully.")

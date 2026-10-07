import os

file_path = 'backend/src/routes/board.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "router.get('/reviews/:partnerId', async (req, res) => {"

new_route = """
// 리뷰 작성자 명단 추출 (기간 필터)
router.get('/reviews/:partnerId/export', async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate, endDate required' });
    
    const start = new Date(startDate as string);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    
    const posts = await prisma.boardPost.findMany({
      where: { 
        type: 'REVIEW', 
        partnerId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        authorName: true,
        maskedPhone: true,
      },
    });
    res.json({ list: posts });
  } catch (error) {
    console.error('리뷰 추출 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.get('/reviews/:partnerId', async (req, res) => {"""

if target in content and "/reviews/:partnerId/export" not in content:
    content = content.replace(target, new_route)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Backend patched successfully!")
else:
    print("Target not found or already patched.")

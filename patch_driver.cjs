const fs = require('fs');
let code = fs.readFileSync('backend/src/routes/driver.ts', 'utf8');

const endpoints = `
// ============================================
// 기사 본인 하루 정산 통계 조회
// ============================================
router.get('/daily-stats', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const dateQuery = req.query.date as string; // YYYY-MM-DD
    
    // 기사 프로필 찾기
    const driver = await prisma.driverProfile.findUnique({
      where: { userId }
    });
    
    if (!driver) {
      return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    }

    let dateFilter = {};
    if (dateQuery) {
      const startOfDay = new Date(dateQuery + 'T00:00:00.000Z');
      const endOfDay = new Date(dateQuery + 'T23:59:59.999Z');
      
      // 한국 시간 기준으로 보정 (옵션에 따라 다름)
      startOfDay.setHours(startOfDay.getHours() - 9);
      endOfDay.setHours(endOfDay.getHours() - 9);

      dateFilter = {
        completedDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      };
    } else {
      // 날짜가 없으면 오늘을 기준으로
      const now = new Date();
      now.setHours(now.getHours() + 9); // KST 변환
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      
      const startOfDay = new Date(\`\${yyyy}-\${mm}-\${dd}T00:00:00.000Z\`);
      const endOfDay = new Date(\`\${yyyy}-\${mm}-\${dd}T23:59:59.999Z\`);
      
      startOfDay.setHours(startOfDay.getHours() - 9);
      endOfDay.setHours(endOfDay.getHours() - 9);

      dateFilter = {
        completedDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      };
    }

    // 통계 계산
    const completedRequests = await prisma.request.findMany({
      where: {
        driverId: driver.id,
        status: 'COMPLETED',
        ...dateFilter
      },
      select: {
        actualWeight: true,
        totalPrice: true
      }
    });

    const stats = {
      count: completedRequests.length,
      totalWeight: completedRequests.reduce((acc: number, req: any) => acc + (req.actualWeight || 0), 0),
      totalPrice: completedRequests.reduce((acc: number, req: any) => acc + (req.totalPrice || 0), 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('일일 정산 조회 실패:', error);
    res.status(500).json({ error: '일일 정산 내역을 가져오는데 실패했습니다.' });
  }
});

// ============================================
// 커스텀 문자 템플릿 저장 및 조회
// ============================================
router.get('/sms-template', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const driver = await prisma.driverProfile.findUnique({
      where: { userId }
    });
    
    if (!driver) return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    
    res.json({ smsTemplates: driver.smsTemplates || null });
  } catch (error) {
    res.status(500).json({ error: '템플릿 조회 실패' });
  }
});

router.put('/sms-template', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const { smsTemplates } = req.body;
    
    const driver = await prisma.driverProfile.findUnique({
      where: { userId }
    });
    
    if (!driver) return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    
    await prisma.driverProfile.update({
      where: { id: driver.id },
      data: { smsTemplates }
    });
    
    res.json({ success: true, message: '저장되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '템플릿 저장 실패' });
  }
});
`;

code = code.replace('export default router;', endpoints + '\nexport default router;');
fs.writeFileSync('backend/src/routes/driver.ts', code);

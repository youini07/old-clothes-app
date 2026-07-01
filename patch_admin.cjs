const fs = require('fs');
let code = fs.readFileSync('backend/src/routes/admin.ts', 'utf8');

const endpoints = `
// ============================================
// 전체 기사 하루 정산 통계 조회
// ============================================
router.get('/drivers/daily-stats', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const dateQuery = req.query.date as string;
    
    // 이 파트너 소속의 기사들 찾기
    const drivers = await prisma.driverProfile.findMany({
      where: { partnerId },
      include: { user: true }
    });
    
    const driverIds = drivers.map(d => d.id);

    let dateFilter = {};
    if (dateQuery) {
      const startOfDay = new Date(dateQuery + 'T00:00:00.000Z');
      const endOfDay = new Date(dateQuery + 'T23:59:59.999Z');
      startOfDay.setHours(startOfDay.getHours() - 9);
      endOfDay.setHours(endOfDay.getHours() - 9);

      dateFilter = {
        completedDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      };
    } else {
      const now = new Date();
      now.setHours(now.getHours() + 9);
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

    const completedRequests = await prisma.request.findMany({
      where: {
        driverId: { in: driverIds },
        status: 'COMPLETED',
        ...dateFilter
      },
      select: {
        driverId: true,
        actualWeight: true,
        totalPrice: true
      }
    });

    const statsMap: any = {};
    drivers.forEach(d => {
      statsMap[d.id] = { driverId: d.id, driverName: d.user.name, count: 0, totalWeight: 0, totalPrice: 0 };
    });

    completedRequests.forEach((req: any) => {
      if (statsMap[req.driverId]) {
        statsMap[req.driverId].count += 1;
        statsMap[req.driverId].totalWeight += (req.actualWeight || 0);
        statsMap[req.driverId].totalPrice += (req.totalPrice || 0);
      }
    });

    res.json(Object.values(statsMap));
  } catch (error) {
    console.error('관리자 기사 통계 조회 실패:', error);
    res.status(500).json({ error: '기사별 통계를 불러오는데 실패했습니다.' });
  }
});
`;

code = code.replace('export default router;', endpoints + '\nexport default router;');
fs.writeFileSync('backend/src/routes/admin.ts', code);

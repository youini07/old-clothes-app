const fs = require('fs');
let code = fs.readFileSync('backend/src/routes/admin.ts', 'utf8');

const s = code.indexOf("router.get('/drivers/daily-stats'");
const e = code.indexOf('});\n\nexport default router;');

if (s !== -1 && e !== -1) {
  const newEndpoint = `
// ============================================
// 전체 기사 하루(또는 기간) 정산 통계 조회
// ============================================
router.get('/drivers/daily-stats', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const { date, startDate, endDate } = req.query;
    
    // 이 파트너 소속의 기사들 찾기
    const drivers = await prisma.driverProfile.findMany({
      where: { partnerId },
      include: { user: true }
    });
    
    const driverIds = drivers.map(d => d.id);

    let dateFilter = {};
    
    if (startDate && endDate) {
      const start = new Date(startDate as string + 'T00:00:00.000Z');
      const end = new Date(endDate as string + 'T23:59:59.999Z');
      start.setHours(start.getHours() - 9);
      end.setHours(end.getHours() - 9);
      dateFilter = { completedDate: { gte: start, lte: end } };
    } else if (date) {
      const startOfDay = new Date(date as string + 'T00:00:00.000Z');
      const endOfDay = new Date(date as string + 'T23:59:59.999Z');
      startOfDay.setHours(startOfDay.getHours() - 9);
      endOfDay.setHours(endOfDay.getHours() - 9);
      dateFilter = { completedDate: { gte: startOfDay, lte: endOfDay } };
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
      dateFilter = { completedDate: { gte: startOfDay, lte: endOfDay } };
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
        totalPrice: true,
        completedDate: true
      }
    });

    // 날짜 + 기사별로 그룹화
    // 결과 형태: { "2026-07-01": { "driver1": {count, weight, price}, ... } }
    const results: any[] = [];
    
    // completedRequests를 돌면서 date 추출
    const grouped: any = {};
    
    completedRequests.forEach((req: any) => {
      if (!req.completedDate) return;
      const d = new Date(req.completedDate);
      d.setHours(d.getHours() + 9); // KST 보정
      const dateStr = d.toISOString().split('T')[0];
      
      if (!grouped[dateStr]) grouped[dateStr] = {};
      if (!grouped[dateStr][req.driverId]) {
        grouped[dateStr][req.driverId] = {
          date: dateStr,
          driverId: req.driverId,
          count: 0,
          totalWeight: 0,
          totalPrice: 0
        };
      }
      
      grouped[dateStr][req.driverId].count += 1;
      grouped[dateStr][req.driverId].totalWeight += (req.actualWeight || 0);
      grouped[dateStr][req.driverId].totalPrice += (req.totalPrice || 0);
    });
    
    // 만약 단일 날짜(date) 쿼리라면 기존처럼 평탄화된 배열로 리턴 (호환성)
    if (date || (!startDate && !endDate)) {
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
      return res.json(Object.values(statsMap));
    }
    
    // startDate, endDate 쿼리라면 배열로 리턴
    Object.keys(grouped).forEach(dateStr => {
      Object.keys(grouped[dateStr]).forEach(driverId => {
        results.push(grouped[dateStr][driverId]);
      });
    });

    res.json(results);
  } catch (error) {
    console.error('관리자 기사 통계 조회 실패:', error);
    res.status(500).json({ error: '기사별 통계를 불러오는데 실패했습니다.' });
  }
});`;

  code = code.substring(0, s) + newEndpoint.trim() + '\n\nexport default router;';
  fs.writeFileSync('backend/src/routes/admin.ts', code);
  console.log('Admin route updated');
} else {
  console.log('Endpoint not found');
}

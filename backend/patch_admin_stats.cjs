const fs = require('fs');

let content = fs.readFileSync('src/routes/admin.ts', 'utf8');

// 1. GET /stats
content = content.replace(
  `    const allRequests = await prisma.request.findMany({
      where: {
        partnerId: partnerId,
        ...demoExcludeFilter
      },
      orderBy: { createdAt: 'desc' }
    });`,
  `    const allRequests = await prisma.request.findMany({
      where: {
        partnerId: partnerId,
        ...demoExcludeFilter
      },
      include: { collectionItems: true },
      orderBy: { createdAt: 'desc' }
    });`
);

content = content.replace(
  `    const totalRequests = allRequests.length;
    const completedRequests = allRequests.filter((r: any) => r.status === 'COMPLETED');
    const totalWeight = completedRequests.reduce((sum: number, r: any) => sum + (r.actualWeight || 0), 0);
    const completionRate = totalRequests > 0 ? Math.round((completedRequests.length / totalRequests) * 100) : 0;

    // 월별 통계 (최근 6개월)`,
  `    const totalRequests = allRequests.length;
    const completedRequests = allRequests.filter((r: any) => r.status === 'COMPLETED');
    const totalWeight = completedRequests.reduce((sum: number, r: any) => sum + (r.actualWeight || 0), 0);
    const completionRate = totalRequests > 0 ? Math.round((completedRequests.length / totalRequests) * 100) : 0;

    const categoryStatsMap = completedRequests.reduce((acc: any, r: any) => {
      r.collectionItems?.forEach((item: any) => {
        if (!acc[item.categoryLabel]) {
          acc[item.categoryLabel] = { categoryLabel: item.categoryLabel, quantity: 0, subtotal: 0, unitType: item.unitType };
        }
        acc[item.categoryLabel].quantity += item.quantity;
        acc[item.categoryLabel].subtotal += item.subtotal;
      });
      return acc;
    }, {});
    const categoryStats = Object.values(categoryStatsMap);

    // 월별 통계 (최근 6개월)`
);

content = content.replace(
  `      summary: {
        totalRequests,
        completedCount: completedRequests.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        completionRate,
        pendingCount: allRequests.filter((r: any) => r.status === 'PENDING').length,
        inProgressCount: allRequests.filter((r: any) => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED').length,
      },`,
  `      summary: {
        totalRequests,
        completedCount: completedRequests.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        completionRate,
        pendingCount: allRequests.filter((r: any) => r.status === 'PENDING').length,
        inProgressCount: allRequests.filter((r: any) => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED').length,
        categoryStats,
      },`
);

// 2. GET /monitoring
content = content.replace(
  `    // 1. 전체 수거 건 통계 (더미 데이터 제외)
    const allRequestsRaw = await prisma.request.findMany({
      include: { partner: true },
      orderBy: { createdAt: 'desc' }
    });`,
  `    // 1. 전체 수거 건 통계 (더미 데이터 제외)
    const allRequestsRaw = await prisma.request.findMany({
      include: { partner: true, collectionItems: true },
      orderBy: { createdAt: 'desc' }
    });`
);

content = content.replace(
  `    const total = allRequests.length;
    const completed = allRequests.filter((r: any) => r.status === 'COMPLETED');
    const totalWeight = completed.reduce((s: number, r: any) => s + (r.actualWeight || 0), 0);`,
  `    const total = allRequests.length;
    const completed = allRequests.filter((r: any) => r.status === 'COMPLETED');
    const totalWeight = completed.reduce((s: number, r: any) => s + (r.actualWeight || 0), 0);

    const globalCategoryStatsMap = completed.reduce((acc: any, r: any) => {
      r.collectionItems?.forEach((item: any) => {
        if (!acc[item.categoryLabel]) {
          acc[item.categoryLabel] = { categoryLabel: item.categoryLabel, quantity: 0, subtotal: 0, unitType: item.unitType };
        }
        acc[item.categoryLabel].quantity += item.quantity;
        acc[item.categoryLabel].subtotal += item.subtotal;
      });
      return acc;
    }, {});
    const globalCategoryStats = Object.values(globalCategoryStatsMap);`
);

content = content.replace(
  `      overview: {
        totalRequests: total,
        completedCount: completed.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
        pendingCount: allRequests.filter((r: any) => r.status === 'PENDING').length,
        inProgressCount: allRequests.filter((r: any) => ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(r.status)).length,
        partnerCount: partners.length,
      },`,
  `      overview: {
        totalRequests: total,
        completedCount: completed.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
        pendingCount: allRequests.filter((r: any) => r.status === 'PENDING').length,
        inProgressCount: allRequests.filter((r: any) => ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(r.status)).length,
        partnerCount: partners.length,
        categoryStats: globalCategoryStats,
      },`
);

// 3. GET /drivers/daily-stats
content = content.replace(
  `      select: {
        driverId: true,
        actualWeight: true,
        totalPrice: true,
        completedDate: true
      }`,
  `      select: {
        driverId: true,
        actualWeight: true,
        totalPrice: true,
        completedDate: true,
        collectionItems: true
      }`
);

content = content.replace(
  `      if (!grouped[dateStr][req.driverId]) {
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
    });`,
  `      if (!grouped[dateStr][req.driverId]) {
        grouped[dateStr][req.driverId] = {
          date: dateStr,
          driverId: req.driverId,
          count: 0,
          totalWeight: 0,
          totalPrice: 0,
          categoryStats: {}
        };
      }
      
      grouped[dateStr][req.driverId].count += 1;
      grouped[dateStr][req.driverId].totalWeight += (req.actualWeight || 0);
      grouped[dateStr][req.driverId].totalPrice += (req.totalPrice || 0);
      
      req.collectionItems?.forEach((item: any) => {
        if (!grouped[dateStr][req.driverId].categoryStats[item.categoryLabel]) {
          grouped[dateStr][req.driverId].categoryStats[item.categoryLabel] = { categoryLabel: item.categoryLabel, quantity: 0, subtotal: 0, unitType: item.unitType };
        }
        grouped[dateStr][req.driverId].categoryStats[item.categoryLabel].quantity += item.quantity;
        grouped[dateStr][req.driverId].categoryStats[item.categoryLabel].subtotal += item.subtotal;
      });
    });`
);

content = content.replace(
  `    // startDate, endDate 쿼리라면 배열로 리턴
    Object.keys(grouped).forEach(dateStr => {
      Object.keys(grouped[dateStr]).forEach(driverId => {
        results.push(grouped[dateStr][driverId]);
      });
    });`,
  `    // startDate, endDate 쿼리라면 배열로 리턴
    Object.keys(grouped).forEach(dateStr => {
      Object.keys(grouped[dateStr]).forEach(driverId => {
        const driverStats = grouped[dateStr][driverId];
        driverStats.categoryStats = Object.values(driverStats.categoryStats);
        results.push(driverStats);
      });
    });`
);

content = content.replace(
  `    // 만약 단일 날짜(date) 쿼리라면 기존처럼 평탄화된 배열로 리턴 (호환성)
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
    }`,
  `    // 만약 단일 날짜(date) 쿼리라면 기존처럼 평탄화된 배열로 리턴 (호환성)
    if (date || (!startDate && !endDate)) {
      const statsMap: any = {};
      drivers.forEach(d => {
        statsMap[d.id] = { driverId: d.id, driverName: d.user.name, count: 0, totalWeight: 0, totalPrice: 0, categoryStats: {} };
      });
      completedRequests.forEach((req: any) => {
        if (statsMap[req.driverId]) {
          statsMap[req.driverId].count += 1;
          statsMap[req.driverId].totalWeight += (req.actualWeight || 0);
          statsMap[req.driverId].totalPrice += (req.totalPrice || 0);
          
          req.collectionItems?.forEach((item: any) => {
            if (!statsMap[req.driverId].categoryStats[item.categoryLabel]) {
              statsMap[req.driverId].categoryStats[item.categoryLabel] = { categoryLabel: item.categoryLabel, quantity: 0, subtotal: 0, unitType: item.unitType };
            }
            statsMap[req.driverId].categoryStats[item.categoryLabel].quantity += item.quantity;
            statsMap[req.driverId].categoryStats[item.categoryLabel].subtotal += item.subtotal;
          });
        }
      });
      
      const flatResults = Object.values(statsMap).map((s: any) => ({
        ...s,
        categoryStats: Object.values(s.categoryStats)
      }));
      return res.json(flatResults);
    }`
);

fs.writeFileSync('src/routes/admin.ts', content, 'utf8');
console.log('Patch applied successfully.');

const fs = require('fs');

let content = fs.readFileSync('src/routes/admin.ts', 'utf8');

// Update select
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

// Update grouped array calculation
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

// Update grouping result push
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

// Update single day flat Map
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
console.log('Driver daily stats patched successfully');

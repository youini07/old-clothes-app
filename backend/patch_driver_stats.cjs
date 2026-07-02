const fs = require('fs');

let content = fs.readFileSync('src/routes/driver.ts', 'utf8');

content = content.replace(
  `      select: {
        actualWeight: true,
        totalPrice: true
      }`,
  `      select: {
        actualWeight: true,
        totalPrice: true,
        collectionItems: true
      }`
);

content = content.replace(
  `    const stats = {
      count: completedRequests.length,
      totalWeight: completedRequests.reduce((acc: number, req: any) => acc + (req.actualWeight || 0), 0),
      totalPrice: completedRequests.reduce((acc: number, req: any) => acc + (req.totalPrice || 0), 0)
    };`,
  `    const categoryStatsMap = completedRequests.reduce((acc: any, r: any) => {
      r.collectionItems?.forEach((item: any) => {
        if (!acc[item.categoryLabel]) {
          acc[item.categoryLabel] = { categoryLabel: item.categoryLabel, quantity: 0, subtotal: 0, unitType: item.unitType };
        }
        acc[item.categoryLabel].quantity += item.quantity;
        acc[item.categoryLabel].subtotal += item.subtotal;
      });
      return acc;
    }, {});
    
    const stats = {
      count: completedRequests.length,
      totalWeight: completedRequests.reduce((acc: number, req: any) => acc + (req.actualWeight || 0), 0),
      totalPrice: completedRequests.reduce((acc: number, req: any) => acc + (req.totalPrice || 0), 0),
      categoryStats: Object.values(categoryStatsMap)
    };`
);

fs.writeFileSync('src/routes/driver.ts', content, 'utf8');
console.log('Patch driver applied successfully.');

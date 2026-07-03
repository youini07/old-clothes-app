const fs = require('fs');
const path = 'backend/src/routes/admin.ts';
let content = fs.readFileSync(path, 'utf8');

const newRoute = `
// ==========================================
// [마케팅 센터 / CRM] 고객 목록 집계 API
// ==========================================
router.get('/crm/customers', authenticate, requireRole(['SUPER_ADMIN', 'PARTNER']), async (req, res) => {
  try {
    const { partnerId } = req.user;
    
    // 파트너인 경우 본인 업체의 수거건만, 슈퍼관리자는 전체
    const whereClause = req.user.role === 'PARTNER' 
      ? { partnerId, status: 'COMPLETED' }
      : { status: 'COMPLETED' };

    const completedRequests = await prisma.request.findMany({
      where: whereClause,
      include: {
        driver: { select: { name: true } }
      },
      orderBy: { completedDate: 'desc' }
    });

    const customerMap = {};

    for (const req of completedRequests) {
      // 휴대폰 번호를 기준으로 고객을 식별
      const phone = req.phone;
      if (!phone) continue;

      if (!customerMap[phone]) {
        customerMap[phone] = {
          phone,
          userName: req.userName,
          address: req.address,
          detailAddress: req.detailAddress || '',
          totalRequests: 0,
          totalWeight: 0,
          totalPaid: 0,
          lastRequestDate: req.completedDate,
          lastDriverName: req.driver?.name || '알 수 없음',
          joinDate: req.createdAt
        };
      }
      
      const customer = customerMap[phone];
      customer.totalRequests += 1;
      customer.totalWeight += req.totalWeight || 0;
      customer.totalPaid += req.totalPrice || 0;
      
      // 최신 정보 유지 (이미 completedDate desc 로 정렬해서 가져오므로 첫번째가 최신)
      if (new Date(req.completedDate) > new Date(customer.lastRequestDate)) {
        customer.lastRequestDate = req.completedDate;
        customer.lastDriverName = req.driver?.name || '알 수 없음';
      }
      if (new Date(req.createdAt) < new Date(customer.joinDate)) {
        customer.joinDate = req.createdAt;
      }
    }

    const customers = Object.values(customerMap).sort((a, b) => b.totalRequests - a.totalRequests);

    res.json({ customers });
  } catch (error) {
    console.error('CRM 고객 목록 집계 오류:', error);
    res.status(500).json({ error: '고객 목록을 집계하는 중 오류가 발생했습니다.' });
  }
});

export default router;`;

if (!content.includes('/crm/customers')) {
  content = content.replace(/export default router;/g, newRoute);
  fs.writeFileSync(path, content, 'utf8');
  console.log('CRM route injected.');
} else {
  console.log('CRM route already exists.');
}

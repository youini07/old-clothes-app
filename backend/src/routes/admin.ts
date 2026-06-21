import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { validatePartner, validateDriver } from '../middleware/validateMiddleware';
import { getStatusForAction } from '../services/statusService';

const router = express.Router();

// ==========================================
// [SUPER_ADMIN 전용] 플랫폼 관리 기능
// ==========================================

// 1. 전체 지역 파트너(업체 사장님) 목록 및 신청 내역 조회
router.get('/partners', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'PARTNER' },
      include: {
        coverageRegions: {
          include: { region: true }
        }
      }
    });
    
    // UI에 맞는 형식으로 변환
    const partners = users.map(user => ({
      id: user.id,
      businessName: user.businessName || user.name + ' (상호명)', // DB 상호명 우선
      ownerName: user.name,
      phone: user.phone || '연락처 없음',
      isApproved: user.isApproved,
      useBizMessage: user.useBizMessage,
      regions: user.coverageRegions.map((cr: any) => ({
        regionId: cr.region.id,
        province: cr.region.province,
        city: cr.region.city,
        town: cr.region.town || ''
      }))
    }));

    res.json({ partners });
  } catch (error) {
    res.status(500).json({ error: '파트너 목록 조회 실패' });
  }
});

// 파트너 권역 추가 (새로운 라우트)
router.post('/partners/:id/coverage', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  const { province, city, dong } = req.body;
  const town = dong && dong !== '전체' ? dong : null;

  try {
    const regionIdStr = town ? `region-${province}-${city}-${town}` : `region-${province}-${city}`;
    const region = await prisma.region.upsert({
      where: { id: regionIdStr },
      update: {},
      create: { province, city, town }
    }).catch(async () => {
      let existingRegion = await prisma.region.findFirst({
        where: { province, city, town }
      });
      if (!existingRegion) {
        existingRegion = await prisma.region.create({
          data: { province, city, town }
        });
      }
      return existingRegion;
    });

    const coverage = await prisma.coverage.create({
      data: {
        partnerId: id,
        regionId: region.id
      }
    });

    res.json({ message: '권역이 성공적으로 추가되었습니다.', coverage });
  } catch (error) {
    console.error('권역 추가 에러:', error);
    res.status(500).json({ error: '권역 추가 중 오류가 발생했습니다.' });
  }
});

// 파트너 권역 삭제 (새로운 라우트)
router.delete('/partners/:id/coverage/:regionId', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { id, regionId } = req.params;

  try {
    // coverage의 고유 복합키를 찾거나, 직접 삭제
    // Prisma에서 deleteMany를 사용하거나 고유 제약조건을 이용해 삭제합니다.
    await prisma.coverage.deleteMany({
      where: {
        partnerId: id,
        regionId: regionId
      }
    });

    res.json({ message: '권역이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('권역 삭제 에러:', error);
    res.status(500).json({ error: '권역 삭제 중 오류가 발생했습니다.' });
  }
});

import bcrypt from 'bcryptjs';

// 파트너 사장님 수동 등록 (입력값 검증 포함)
router.post('/partners', validatePartner, authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { name, phone, email, businessName, province, city, dong } = req.body;
  const town = dong && dong !== '전체' ? dong : null;

  try {
    // 1. 파트너 계정 찾거나 생성 (초기 비밀번호는 연락처로 설정 후 암호화)
    const initialPassword = phone || '12345678';
    const hashedPassword = await bcrypt.hash(initialPassword, 10);

    // 이미 가입된 이메일이 있다면 역할만 업데이트, 없으면 새로 생성
    const newPartner = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        phone,
        password: hashedPassword,
        businessName,
        role: 'PARTNER',
        isApproved: true
      },
      create: {
        name,
        phone,
        email,
        password: hashedPassword,
        businessName,
        role: 'PARTNER',
        isApproved: true
      }
    });

    // 2. 권역 찾기 또는 생성
    const regionIdStr = town ? `region-${province}-${city}-${town}` : `region-${province}-${city}`;
    const region = await prisma.region.upsert({
      where: {
        id: regionIdStr
      },
      update: {},
      create: {
        province,
        city,
        town
      }
    }).catch(async () => {
      // upsert가 실패하는 경우, 수동 조회 후 생성
      let existingRegion = await prisma.region.findFirst({
        where: { province, city, town }
      });
      if (!existingRegion) {
        existingRegion = await prisma.region.create({
          data: { province, city, town }
        });
      }
      return existingRegion;
    });

    // 3. 파트너에게 권역 할당
    await prisma.coverage.create({
      data: {
        partnerId: newPartner.id,
        regionId: region.id
      }
    });

    res.json({ message: '파트너가 성공적으로 등록되었습니다.', partner: newPartner });
  } catch (error) {
    console.error('파트너 등록 에러:', error);
    res.status(500).json({ error: '파트너 등록 중 오류가 발생했습니다.' });
  }
});

// 2. 파트너 승인 처리 (새로운 라우트)
router.patch('/partners/:id/approve', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const updatedPartner = await prisma.user.update({
      where: { id, role: 'PARTNER' },
      data: { isApproved: true }
    });
    res.json({ message: '파트너가 승인되었습니다.', partner: updatedPartner });
  } catch (error) {
    res.status(500).json({ error: '파트너 승인 처리 실패' });
  }
});

// 기존 coverage approve 삭제 또는 유지
// router.post('/coverage/approve', ...) -> 주석 처리 또는 제거

// 3. 파트너 알림톡 사용 여부 토글 (ON/OFF)
router.patch('/partners/:id/biz-message', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  const { useBizMessage } = req.body;
  try {
    const updatedPartner = await prisma.user.update({
      where: { id, role: 'PARTNER' },
      data: { useBizMessage }
    });
    res.json({ message: '알림톡 설정이 변경되었습니다.', partner: updatedPartner });
  } catch (error) {
    res.status(500).json({ error: '알림톡 설정 변경 실패' });
  }
});

// ==========================================
// [PARTNER 전용] 파트너 업체 대시보드 기능
// ==========================================

// 1. 본인 권역에 들어온 수거 신청 목록 조회
router.get('/requests', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    
    // 파트너가 담당하는 권역 ID 목록 가져오기
    const coverages = await prisma.coverage.findMany({
      where: { partnerId }
    });
    const regionIds = coverages.map((c: any) => c.regionId);

    // 해당 권역에 속하거나, 직접 파트너에게 할당된 신청건 조회
    const requests = await prisma.request.findMany({
      where: {
        OR: [
          { regionId: { in: regionIds } },
          { partnerId: partnerId }
        ]
      },
      include: {
        driver: { include: { user: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: '수거 신청 목록 조회 실패' });
  }
});

// 2. 수거 기사(Driver) 목록 조회
router.get('/drivers', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const drivers = await prisma.driverProfile.findMany({
      where: { partnerId },
      include: { user: true }
    });
    res.json({ drivers });
  } catch (error) {
    res.status(500).json({ error: '기사 목록 조회 실패' });
  }
});

// 기사(Driver) 신규 등록 (입력값 검증 포함)
router.post('/drivers', validateDriver, authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const { name, phone, email, vehicleInfo } = req.body;

    // 초기 비밀번호는 연락처로 설정
    const initialPassword = phone || '12345678';
    const hashedPassword = await bcrypt.hash(initialPassword, 10);

    // 1. User 테이블에 기사 계정 생성 (또는 업데이트)
    const newDriverUser = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        phone,
        password: hashedPassword,
        role: 'DRIVER',
        isApproved: true
      },
      create: {
        name,
        phone,
        email,
        password: hashedPassword,
        role: 'DRIVER',
        isApproved: true
      }
    });

    // 2. DriverProfile 생성 (또는 업데이트)
    const newDriverProfile = await prisma.driverProfile.upsert({
      where: { userId: newDriverUser.id },
      update: {
        partnerId,
        vehicleInfo
      },
      create: {
        userId: newDriverUser.id,
        partnerId,
        vehicleInfo
      }
    });

    // 응답 시 프론트엔드 형식에 맞게 user 정보 포함
    res.json({ message: '기사님이 성공적으로 등록되었습니다.', driver: { ...newDriverProfile, user: newDriverUser } });
  } catch (error) {
    console.error('기사 등록 에러:', error);
    res.status(500).json({ error: '기사 등록 중 오류가 발생했습니다.' });
  }
});

// 3. 기사에게 수거 신청건 배정 (일정 및 동선 확정)
router.post('/assign-driver', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  const { requestId, driverId, confirmedDate } = req.body;
  try {
    const request = await prisma.request.update({
      where: { id: requestId },
      data: {
        driverId,
        status: getStatusForAction.onDriverAssigned(),
        confirmedDate: new Date(confirmedDate)
      }
    });
    res.json({ message: '기사 배정이 완료되었습니다.', request });
  } catch (error) {
    res.status(500).json({ error: '기사 배정 실패' });
  }
});

// ==========================================
// [PARTNER 전용] 정산 및 통계 기능
// ==========================================
router.get('/stats', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;

    // 파트너가 담당하는 권역 ID 목록
    const coverages = await prisma.coverage.findMany({ where: { partnerId } });
    const regionIds = coverages.map((c: any) => c.regionId);

    // 해당 파트너에게 배정된 모든 수거 건 조회
    const allRequests = await prisma.request.findMany({
      where: {
        OR: [
          { regionId: { in: regionIds } },
          { partnerId: partnerId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    // 전체 통계 계산
    const totalRequests = allRequests.length;
    const completedRequests = allRequests.filter((r: any) => r.status === 'COMPLETED');
    const totalWeight = completedRequests.reduce((sum: number, r: any) => sum + (r.actualWeight || 0), 0);
    const completionRate = totalRequests > 0 ? Math.round((completedRequests.length / totalRequests) * 100) : 0;

    // 월별 통계 (최근 6개월)
    const monthlyStats: { month: string; count: number; weight: number; completed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthLabel = `${year}.${String(month + 1).padStart(2, '0')}`;

      const monthRequests = allRequests.filter((r: any) => {
        const d = new Date(r.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const monthCompleted = monthRequests.filter((r: any) => r.status === 'COMPLETED');
      const monthWeight = monthCompleted.reduce((sum: number, r: any) => sum + (r.actualWeight || 0), 0);

      monthlyStats.push({
        month: monthLabel,
        count: monthRequests.length,
        weight: Math.round(monthWeight * 10) / 10,
        completed: monthCompleted.length,
      });
    }

    res.json({
      summary: {
        totalRequests,
        completedCount: completedRequests.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        completionRate,
        pendingCount: allRequests.filter((r: any) => r.status === 'PENDING').length,
        inProgressCount: allRequests.filter((r: any) => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED').length,
      },
      monthlyStats,
    });
  } catch (error) {
    console.error('통계 조회 에러:', error);
    res.status(500).json({ error: '통계 데이터 조회 실패' });
  }
});

// ==========================================
// [SUPER_ADMIN 전용] 전국 통합 모니터링
// ==========================================
router.get('/monitoring', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    // 1. 전체 수거 건 통계
    const allRequests = await prisma.request.findMany({
      include: { partner: true },
      orderBy: { createdAt: 'desc' }
    });

    const total = allRequests.length;
    const completed = allRequests.filter((r: any) => r.status === 'COMPLETED');
    const totalWeight = completed.reduce((s: number, r: any) => s + (r.actualWeight || 0), 0);

    // 2. 파트너별 성과 (수거 건수, 완료율, 총 무게)
    const partners = await prisma.user.findMany({
      where: { role: 'PARTNER' },
      select: { id: true, name: true, businessName: true }
    });

    const partnerStats = partners.map((p: any) => {
      const pRequests = allRequests.filter((r: any) => r.partnerId === p.id);
      const pCompleted = pRequests.filter((r: any) => r.status === 'COMPLETED');
      const pWeight = pCompleted.reduce((s: number, r: any) => s + (r.actualWeight || 0), 0);
      return {
        id: p.id,
        name: p.businessName || p.name,
        totalRequests: pRequests.length,
        completedCount: pCompleted.length,
        completionRate: pRequests.length > 0 ? Math.round((pCompleted.length / pRequests.length) * 100) : 0,
        totalWeight: Math.round(pWeight * 10) / 10,
      };
    }).sort((a: any, b: any) => b.totalRequests - a.totalRequests);

    // 3. 권역별 현황
    const regions = await prisma.region.findMany({
      include: { coverages: { include: { partner: true } } }
    });

    const regionStats = regions.map((r: any) => {
      const rRequests = allRequests.filter((req: any) => req.regionId === r.id);
      return {
        id: r.id,
        name: `${r.province} ${r.city}${r.town ? ' ' + r.town : ''}`,
        partner: r.coverages[0]?.partner?.businessName || r.coverages[0]?.partner?.name || '미배정',
        requestCount: rRequests.length,
        completedCount: rRequests.filter((req: any) => req.status === 'COMPLETED').length,
      };
    });

    // 4. 오늘/이번주/이번달 현황
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayRequests = allRequests.filter((r: any) => new Date(r.createdAt) >= todayStart);
    const weekRequests = allRequests.filter((r: any) => new Date(r.createdAt) >= weekStart);
    const monthRequests = allRequests.filter((r: any) => new Date(r.createdAt) >= monthStart);

    // 5. 월별 트렌드 (최근 6개월)
    const monthlyTrend: { month: string; count: number; weight: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const yr = d.getFullYear(), mo = d.getMonth();
      const mReqs = allRequests.filter((r: any) => { const c = new Date(r.createdAt); return c.getFullYear() === yr && c.getMonth() === mo; });
      const mWeight = mReqs.filter((r: any) => r.status === 'COMPLETED').reduce((s: number, r: any) => s + (r.actualWeight || 0), 0);
      monthlyTrend.push({ month: `${yr}.${String(mo + 1).padStart(2, '0')}`, count: mReqs.length, weight: Math.round(mWeight * 10) / 10 });
    }

    res.json({
      overview: {
        totalRequests: total,
        completedCount: completed.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
        pendingCount: allRequests.filter((r: any) => r.status === 'PENDING').length,
        inProgressCount: allRequests.filter((r: any) => ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(r.status)).length,
        partnerCount: partners.length,
      },
      period: {
        today: todayRequests.length,
        thisWeek: weekRequests.length,
        thisMonth: monthRequests.length,
      },
      partnerStats,
      regionStats,
      monthlyTrend,
    });
  } catch (error) {
    console.error('모니터링 데이터 조회 에러:', error);
    res.status(500).json({ error: '모니터링 데이터 조회 실패' });
  }
});

// ==========================================
// [DEBUG] 권역 매칭 디버그 엔드포인트 (임시)
// ==========================================
router.get('/debug/regions', async (req, res) => {
  try {
    const regions = await prisma.region.findMany({
      include: { coverages: { include: { partner: { select: { id: true, name: true, businessName: true } } } } }
    });
    
    const recentRequests = await prisma.request.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, address: true, partnerId: true, regionId: true, status: true, createdAt: true }
    });

    res.json({ regions, recentRequests });
  } catch (error) {
    res.status(500).json({ error: 'debug error', details: String(error) });
  }
});

// [DEBUG] 미배정 수거 신청을 재배정하는 엔드포인트
router.post('/debug/reassign', async (req, res) => {
  try {
    // partnerId가 null인 미배정 요청들을 찾음
    const unassigned = await prisma.request.findMany({
      where: { partnerId: null }
    });

    let reassignedCount = 0;

    for (const request of unassigned) {
      const addressParts = (request.address || '').split(' ');
      let province = addressParts[0] || '';
      if (province === '경기') province = '경기도';
      const city = addressParts[1] || '';
      const town = addressParts[2] || '';

      // 1순위: 정확한 town 매칭
      let region = await prisma.region.findFirst({
        where: { province, city, town },
        include: { coverages: true }
      });

      // 2순위: city 전역 (town: null)
      if ((!region || region.coverages.length === 0) && city) {
        region = await prisma.region.findFirst({
          where: { province, city, town: null },
          include: { coverages: true }
        });
      }

      // 3순위: 같은 city에 등록된 아무 region
      if ((!region || region.coverages.length === 0) && city) {
        region = await prisma.region.findFirst({
          where: { province, city },
          include: { coverages: true }
        });
      }

      if (region && region.coverages.length > 0) {
        await prisma.request.update({
          where: { id: request.id },
          data: {
            partnerId: region.coverages[0].partnerId,
            regionId: region.id,
          }
        });
        reassignedCount++;
      }
    }

    res.json({ 
      message: `${reassignedCount}건 재배정 완료 (총 ${unassigned.length}건 미배정)`,
      reassignedCount,
      totalUnassigned: unassigned.length
    });
  } catch (error) {
    res.status(500).json({ error: 'reassign error', details: String(error) });
  }
});

export default router;

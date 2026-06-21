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

export default router;

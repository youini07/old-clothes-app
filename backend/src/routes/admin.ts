import express from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { validatePartner, validateDriver } from '../middleware/validateMiddleware';
import { getStatusForAction } from '../services/statusService';
import { getCoordinates } from '../services/kakaoRoute';
import { sendAssignmentToCustomer, sendScheduleConfirmedToCustomer } from '../services/notificationService';

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

// 파트너 권역 추가 (시 단위로 통일 — 동(dong) 값은 무시)
router.post('/partners/:id/coverage', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  const { province, city } = req.body;
  // 동(dong) 값은 무시하고 항상 시(city) 단위로 저장
  const town = null;

  try {
    // 같은 province+city 조합이 이미 있으면 재사용, 없으면 생성
    let region = await prisma.region.findFirst({
      where: { province, city, town: null }
    });
    if (!region) {
      region = await prisma.region.create({
        data: { province, city, town: null }
      });
    }

    // 이미 동일한 권역이 할당되어 있는지 확인
    const existingCoverage = await prisma.coverage.findFirst({
      where: { partnerId: id, regionId: region.id }
    });
    if (existingCoverage) {
      return res.json({ message: '이미 해당 권역이 설정되어 있습니다.', coverage: existingCoverage });
    }

    const coverage = await prisma.coverage.create({
      data: {
        partnerId: id,
        regionId: region.id
      }
    });

    res.json({ message: `${city} 전역이 권역으로 추가되었습니다.`, coverage });
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

// 파트너 사장님 수동 등록 (입력값 검증 포함)
router.post('/partners', validatePartner, authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { name, phone, email, businessName, province, city } = req.body;
  // 동(dong) 값은 무시하고 항상 시(city) 단위로 저장
  const town = null;

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

    // 2. 권역 찾기 또는 생성 (시 단위로 통일)
    let region = await prisma.region.findFirst({
      where: { province, city, town: null }
    });
    if (!region) {
      region = await prisma.region.create({
        data: { province, city, town: null }
      });
    }

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
// - 권역 미설정 사장님 → 전체 미배정 요청 노출
// - 권역 설정된 사장님 → 해당 시(city) 주소의 미배정 요청 노출
router.get('/requests', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    
    // 파트너가 담당하는 권역 정보 가져오기
    const coverages = await prisma.coverage.findMany({
      where: { partnerId },
      include: { region: true }
    });

    let requests;

    if (coverages.length === 0) {
      // 권역 미설정 → 전체 지역의 미배정 요청 + 본인에게 이미 배정된 요청
      requests = await prisma.request.findMany({
        where: {
          OR: [
            { partnerId: null, status: 'PENDING' },   // 아직 아무도 수락하지 않은 건
            { partnerId: partnerId }                    // 이미 본인이 수락한 건
          ]
        },
        include: {
          driver: { include: { user: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // 권역 설정됨 → 해당 시(city)의 주소를 가진 미배정 요청 + 본인 배정 건
      // 권역에서 city 목록 추출 (예: ['평택시', '안성시'])
      const cities = coverages.map((c: any) => c.region.city);
      
      // 모든 미배정 요청을 가져온 후, 주소에 해당 city가 포함된 것만 필터링
      const allPending = await prisma.request.findMany({
        where: { partnerId: null, status: 'PENDING' },
        include: { driver: { include: { user: true } } },
        orderBy: { createdAt: 'desc' }
      });
      
      // 주소에서 시(city) 매칭 필터링
      const matchedPending = allPending.filter((r: any) => {
        return cities.some((city: string) => r.address.includes(city));
      });

      // 본인에게 이미 배정된 건도 포함
      const myRequests = await prisma.request.findMany({
        where: { partnerId: partnerId },
        include: { driver: { include: { user: true } } },
        orderBy: { createdAt: 'desc' }
      });

      // 중복 제거 후 합치기
      const requestMap = new Map();
      [...matchedPending, ...myRequests].forEach((r: any) => requestMap.set(r.id, r));
      requests = Array.from(requestMap.values()).sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    
    res.json({ requests });
  } catch (error) {
    console.error('수거 신청 목록 조회 실패:', error);
    res.status(500).json({ error: '수거 신청 목록 조회 실패' });
  }
});

// 수거 요청 수락 (선착순 방식 — 먼저 수락한 사장님에게 배정)
router.post('/requests/:id/claim', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  const partnerId = req.user!.userId;

  try {
    // 해당 요청의 현재 상태 확인
    const request = await prisma.request.findUnique({ where: { id } });
    
    if (!request) {
      return res.status(404).json({ error: '해당 수거 신청을 찾을 수 없습니다.' });
    }

    // 이미 다른 사장님이 수락한 건인지 확인 (동시성 제어)
    if (request.partnerId !== null) {
      if (request.partnerId === partnerId) {
        return res.status(400).json({ error: '이미 본인이 수락한 건입니다.' });
      }
      return res.status(409).json({ error: '이미 다른 업체에서 수락한 건입니다.' });
    }

    const updated = await prisma.request.update({
      where: { 
        id,
        partnerId: null  // 동시성 방어: null인 경우에만 업데이트
      },
      data: {
        partnerId,
        status: 'ASSIGNED'
      },
      include: { partner: true }
    });

    // 업체 배정 안내 알림톡 발송 (비동기)
    if (updated.partner && updated.partner.useBizMessage) {
      sendAssignmentToCustomer(
        updated.phone,
        updated.userName,
        updated.partner.businessName || updated.partner.name,
        updated.partner.useBizMessage
      ).catch(err => console.error('배정 안내 알림톡 전송 실패:', err));
    }

    res.json({ 
      message: '수거 요청을 수락했습니다! 기사를 배정해주세요.',
      request: updated 
    });
  } catch (error: any) {
    // Prisma P2025: Record not found (다른 사장님이 이미 수락)
    if (error?.code === 'P2025') {
      return res.status(409).json({ error: '이미 다른 업체에서 수락한 건입니다.' });
    }
    console.error('수거 요청 수락 오류:', error);
    res.status(500).json({ error: '수거 요청 수락 중 오류가 발생했습니다.' });
  }
});

// 수거 요청 수락 취소 (다시 대기 상태로 변경)
router.post('/requests/:id/unclaim', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  const partnerId = req.user!.userId;

  try {
    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: '해당 수거 신청을 찾을 수 없습니다.' });
    }

    if (request.partnerId !== partnerId) {
      return res.status(403).json({ error: '본인이 수락한 건만 취소할 수 있습니다.' });
    }

    if (request.driverId) {
      return res.status(400).json({ error: '이미 기사에게 배정된 건은 수락을 취소할 수 없습니다. 배정을 먼저 해제해주세요.' });
    }

    const updated = await prisma.request.update({
      where: { id },
      data: {
        partnerId: null,
        status: 'PENDING'
      }
    });

    res.json({ message: '수락이 취소되었습니다.', request: updated });
  } catch (error) {
    console.error('수락 취소 오류:', error);
    res.status(500).json({ error: '수락 취소 중 오류가 발생했습니다.' });
  }
});

// 다중 수거 요청 수락 (일괄 수락)
router.post('/requests/bulk-claim', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const { requestIds } = req.body;
  const partnerId = req.user!.userId;

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({ error: '수락할 요청 ID 배열이 필요합니다.' });
  }

  try {
    const updatedResult = await prisma.request.updateMany({
      where: {
        id: { in: requestIds },
        partnerId: null
      },
      data: {
        partnerId,
        status: 'ASSIGNED'
      }
    });

    if (updatedResult.count > 0) {
      const updatedRequests = await prisma.request.findMany({
        where: { id: { in: requestIds }, partnerId },
        include: { partner: true }
      });

      updatedRequests.forEach(updated => {
        if (updated.partner && updated.partner.useBizMessage) {
          sendAssignmentToCustomer(
            updated.phone,
            updated.userName,
            updated.partner.businessName || updated.partner.name,
            updated.partner.useBizMessage
          ).catch(err => console.error('배정 안내 알림톡 전송 실패:', err));
        }
      });
    }

    res.json({ 
      message: `${updatedResult.count}건의 수거 요청을 수락했습니다!`,
      count: updatedResult.count 
    });
  } catch (error) {
    console.error('일괄 수락 오류:', error);
    res.status(500).json({ error: '일괄 수락 중 오류가 발생했습니다.' });
  }
});

// 다중 수거 요청 수락 취소 (일괄 취소)
router.post('/requests/bulk-unclaim', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const { requestIds } = req.body;
  const partnerId = req.user!.userId;

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({ error: '수락 취소할 요청 ID 배열이 필요합니다.' });
  }

  try {
    // 본인이 수락한 건이고 아직 기사 배정이 안 된 건들만 일괄 취소
    const updatedResult = await prisma.request.updateMany({
      where: {
        id: { in: requestIds },
        partnerId: partnerId,
        driverId: null
      },
      data: {
        partnerId: null,
        status: 'PENDING'
      }
    });

    res.json({ 
      message: `${updatedResult.count}건의 수락이 취소되었습니다.`,
      count: updatedResult.count 
    });
  } catch (error) {
    console.error('일괄 수락 취소 오류:', error);
    res.status(500).json({ error: '일괄 수락 취소 중 오류가 발생했습니다.' });
  }
});

// 2. 수거 기사(Driver) 목록 조회
router.get('/drivers', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const drivers = await prisma.driverProfile.findMany({
      where: { partnerId },
      include: { user: true, customRegion: true }
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
    const { name, phone, email, vehicleInfo, customRegionId } = req.body;

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
        vehicleInfo,
        customRegionId: customRegionId || null
      },
      create: {
        userId: newDriverUser.id,
        partnerId,
        vehicleInfo,
        customRegionId: customRegionId || null
      },
      include: { customRegion: true }
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
      },
      include: { partner: true }
    });

    // 일정 확정 안내 알림톡 발송 (비동기)
    if (request.partner && request.partner.useBizMessage && request.confirmedDate) {
      let driverPhone = undefined;
      if (request.driverId) {
        const driverProfile = await prisma.driverProfile.findUnique({ where: { id: request.driverId }, include: { user: true }});
        if (driverProfile && driverProfile.user.phone) {
          driverPhone = driverProfile.user.phone;
        }
      }

      sendScheduleConfirmedToCustomer(
        request.phone,
        request.userName,
        request.confirmedDate,
        request.partner.useBizMessage,
        driverPhone
      ).catch(err => console.error('일정 확정 알림톡 전송 실패:', err));
    }

    res.json({ message: '기사 배정이 완료되었습니다.', request });
  } catch (error) {
    res.status(500).json({ error: '기사 배정 실패' });
  }
});

// 4. 배정 취소 (기사에게 배정한 수거건 다시 회수)
router.post('/requests/:id/unassign', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const partnerId = req.user!.userId;
    
    // 권한 확인
    const request = await prisma.request.findUnique({ where: { id } });
    if (!request || request.partnerId !== partnerId) {
      return res.status(403).json({ error: '권한이 없거나 찾을 수 없는 요청입니다.' });
    }

    const updated = await prisma.request.update({
      where: { id },
      data: {
        driverId: null,
        status: 'ASSIGNED', // 기사 미배정 상태로 롤백 (파트너는 여전히 수락된 상태)
        confirmedDate: null,
        etaMinutes: null
      }
    });

    res.json({ message: '기사 배정이 취소되었습니다.', request: updated });
  } catch (error) {
    console.error('배정 취소 에러:', error);
    res.status(500).json({ error: '배정 취소 중 오류가 발생했습니다.' });
  }
});

// 5. 사장님 본인을 기사로 자동 등록 (원클릭)
router.post('/drivers/self', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;

    const existing = await prisma.driverProfile.findUnique({ where: { userId: partnerId } });
    if (existing) {
      return res.status(400).json({ error: '이미 사장님 계정으로 기사가 등록되어 있습니다.' });
    }

    const newDriverProfile = await prisma.driverProfile.create({
      data: {
        userId: partnerId,
        partnerId: partnerId,
        vehicleInfo: '사장님 본인 차량' // 기본값
      },
      include: { user: true }
    });

    res.json({ message: '사장님이 기사로 성공적으로 등록되었습니다.', driver: newDriverProfile });
  } catch (error) {
    console.error('사장님 기사 등록 에러:', error);
    res.status(500).json({ error: '기사 등록 중 오류가 발생했습니다.' });
  }
});

// 최적 동선 기능은 기사(Driver) 전용 API로 이전되었습니다. (driver.ts)

// ==========================================
// [PARTNER 전용] 권역 커스터마이징 (CustomRegion)
// ==========================================

// 권역 목록 조회
router.get('/custom-regions', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const regions = await prisma.customRegion.findMany({
      where: { partnerId }
    });
    res.json({ regions });
  } catch (error) {
    res.status(500).json({ error: '권역 목록 조회 실패' });
  }
});

// 새 권역 생성
router.post('/custom-regions', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const { name, areas } = req.body; // areas: string[]

    if (!name || !areas || !Array.isArray(areas)) {
      return res.status(400).json({ error: '권역 이름과 지역 목록이 필요합니다.' });
    }

    const newRegion = await prisma.customRegion.create({
      data: {
        partnerId,
        name,
        areas
      }
    });

    res.json({ message: '권역이 추가되었습니다.', region: newRegion });
  } catch (error) {
    console.error('권역 생성 실패:', error);
    res.status(500).json({ error: '권역 생성 실패' });
  }
});

// 권역 삭제
router.delete('/custom-regions/:id', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const { id } = req.params;

    // 해당 권역이 본인의 것인지 확인
    const region = await prisma.customRegion.findUnique({ where: { id } });
    if (!region || region.partnerId !== partnerId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    // 기사들에게 할당된 권역도 SetNull 되도록 schema에 onDelete: SetNull이 설정되어 있음 (또는 cascade)
    // 수동으로 기사들의 customRegionId를 null로 변경
    await prisma.driverProfile.updateMany({
      where: { customRegionId: id },
      data: { customRegionId: null }
    });

    await prisma.customRegion.delete({
      where: { id }
    });

    res.json({ message: '권역이 삭제되었습니다.' });
  } catch (error) {
    console.error('권역 삭제 실패:', error);
    res.status(500).json({ error: '권역 삭제 실패' });
  }
});

// 기사의 권역(월별 교대용) 및 정보 수정
router.patch('/drivers/:id', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const driverId = req.params.id;
    const { customRegionId, vehicleInfo, name, phone } = req.body;

    // 본인 기사인지 확인
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true }
    });
    
    if (!driver || driver.partnerId !== partnerId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    // 권역 유효성 검사
    if (customRegionId) {
      const region = await prisma.customRegion.findUnique({ where: { id: customRegionId } });
      if (!region || region.partnerId !== partnerId) {
        return res.status(400).json({ error: '유효하지 않은 권역입니다.' });
      }
    }

    const updatedDriverProfile = await prisma.driverProfile.update({
      where: { id: driverId },
      data: { 
        customRegionId: customRegionId || null,
        ...(vehicleInfo !== undefined && { vehicleInfo })
      },
      include: { customRegion: true, user: true }
    });

    if (name || phone) {
      await prisma.user.update({
        where: { id: driver.userId },
        data: {
          ...(name && { name }),
          ...(phone && { phone })
        }
      });
      if (name) updatedDriverProfile.user.name = name;
      if (phone) updatedDriverProfile.user.phone = phone;
    }

    res.json({ message: '기사 정보가 수정되었습니다.', driver: updatedDriverProfile });
  } catch (error) {
    console.error('기사 수정 에러:', error);
    res.status(500).json({ error: '기사 수정 중 오류가 발생했습니다.' });
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

    // 해당 파트너에게 배정(수락)된 수거 건만 조회 (취소한 건은 제외)
    const allRequests = await prisma.request.findMany({
      where: {
        partnerId: partnerId
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

// [DEBUG] 8개 시 80개 랜덤 수거 신청 시드 데이터 생성
router.get('/debug/seed-suwon', async (req, res) => {
  try {
    const citiesData = [
      { city: "수원시", guList: ["장안구", "권선구", "팔달구", "영통구"], dongList: ["정자동", "권선동", "인계동", "영통동", "매탄동", "이의동", "호매실동"] },
      { city: "용인시", guList: ["처인구", "기흥구", "수지구"], dongList: ["역북동", "구갈동", "풍덕천동", "상현동", "보라동", "신갈동"] },
      { city: "성남시", guList: ["수정구", "중원구", "분당구"], dongList: ["태평동", "성남동", "정자동", "서현동", "백현동", "판교동"] },
      { city: "고양시", guList: ["덕양구", "일산동구", "일산서구"], dongList: ["화정동", "마두동", "일산동", "대화동", "정발산동", "행신동"] },
      { city: "안양시", guList: ["만안구", "동안구"], dongList: ["안양동", "석수동", "비산동", "평촌동", "호계동", "관양동"] },
      { city: "안산시", guList: ["상록구", "단원구"], dongList: ["본오동", "사동", "고잔동", "초지동", "선부동", "월피동"] },
      { city: "부천시", guList: ["원미구", "소사구", "오정구"], dongList: ["중동", "상동", "송내동", "오정동", "심곡본동", "역곡동"] },
      { city: "광명시", guList: [""], dongList: ["광명동", "철산동", "하안동", "소하동", "일직동"] }
    ];

    const names = ['김민준', '이서연', '박도윤', '최서윤', '정하준', '강지우', '조서진', '윤하은', '장지호', '임지아', 
                   '한은우', '오민서', '서윤우', '신채원', '권우진', '황수아', '안건우', '송지율', '유연우', '홍다은'];
    const volumes = ['헌옷 15kg', '헌옷 25kg, 신발 3켤레', '30kg 이상 (마대자루 2개)', '소량 (10kg 내외)', '옷 20kg, 가방 5개'];

    await prisma.request.deleteMany({});
    
    let count = 0;
    for (const c of citiesData) {
      let region = await prisma.region.findFirst({
        where: { province: '경기도', city: c.city, town: null }
      });
      if (!region) {
        region = await prisma.region.create({
          data: { province: '경기도', city: c.city, town: null }
        });
      }

      for (let i = 0; i < 10; i++) {
        const gu = c.guList[Math.floor(Math.random() * c.guList.length)];
        const dong = c.dongList[Math.floor(Math.random() * c.dongList.length)];
        const jibun = Math.floor(Math.random() * 1000) + '-' + Math.floor(Math.random() * 10);
        
        const address = gu ? `경기도 ${c.city} ${gu} ${dong} ${jibun}` : `경기도 ${c.city} ${dong} ${jibun}`;
        const sigungu = gu ? `${c.city} ${gu}` : c.city;
        
        await prisma.request.create({
          data: {
            userName: names[Math.floor(Math.random() * names.length)],
            phone: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            address: address,
            detailAddress: Math.floor(Math.random() * 20 + 1) + '층',
            zipCode: '1' + Math.floor(1000 + Math.random() * 9000),
            sigungu: sigungu,
            bname: dong,
            desiredDate: new Date(),
            estimatedVolume: volumes[Math.floor(Math.random() * volumes.length)],
            status: 'PENDING',
            partnerId: null,
            regionId: region.id,
          }
        });
        count++;
      }
    }
    res.json({ message: `Successfully seeded ${count} requests.` });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// [DEBUG] 동(town) 단위 Region을 시(city) 단위로 통합 마이그레이션
router.post('/debug/migrate-regions', async (req, res) => {
  try {
    // 1. town이 null이 아닌 (동 단위) Region 목록 조회
    const townRegions = await prisma.region.findMany({
      where: { town: { not: null } },
      include: { coverages: true }
    });

    let migratedCount = 0;

    for (const oldRegion of townRegions) {
      // 2. 해당 시(city) 단위 Region이 이미 있는지 확인
      let cityRegion = await prisma.region.findFirst({
        where: { province: oldRegion.province, city: oldRegion.city, town: null }
      });

      // 없으면 생성
      if (!cityRegion) {
        cityRegion = await prisma.region.create({
          data: { province: oldRegion.province, city: oldRegion.city, town: null }
        });
      }

      // 3. 기존 Coverage를 새 시 단위 Region으로 이전
      for (const coverage of oldRegion.coverages) {
        // 이미 동일한 Coverage가 있는지 확인
        const existing = await prisma.coverage.findFirst({
          where: { partnerId: coverage.partnerId, regionId: cityRegion.id }
        });
        if (!existing) {
          await prisma.coverage.create({
            data: { partnerId: coverage.partnerId, regionId: cityRegion.id }
          });
        }
        // 기존 동 단위 Coverage 삭제
        await prisma.coverage.delete({ where: { id: coverage.id } });
      }

      // 4. 기존 Request의 regionId도 시 단위로 업데이트
      await prisma.request.updateMany({
        where: { regionId: oldRegion.id },
        data: { regionId: cityRegion.id }
      });

      // 5. 기존 동 단위 Region 삭제
      await prisma.region.delete({ where: { id: oldRegion.id } });
      migratedCount++;
    }

    // 6. 기존 미배정 요청을 PENDING 상태로 리셋 (새 선착순 시스템에 맞게)
    const resetResult = await prisma.request.updateMany({
      where: { partnerId: null, status: { not: 'COMPLETED' } },
      data: { status: 'PENDING' }
    });

    res.json({ 
      message: `${migratedCount}개 동 단위 권역을 시 단위로 통합 완료. ${resetResult.count}건 미배정 요청 PENDING 초기화.`,
      migratedRegions: migratedCount,
      resetRequests: resetResult.count
    });
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    res.status(500).json({ error: 'migration error', details: String(error) });
  }
});

// ==========================================
// [PARTNER 전용] 환경 설정 (단가, 알림톡 설정)
// ==========================================

// 파트너 본인의 설정 정보 조회
router.get('/settings', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: { pricePerKg: true, useBizMessage: true }
    });
    
    if (!partner) {
      return res.status(404).json({ error: '파트너 정보를 찾을 수 없습니다.' });
    }
    
    res.json({ settings: partner });
  } catch (error) {
    console.error('환경 설정 조회 에러:', error);
    res.status(500).json({ error: '환경 설정 조회에 실패했습니다.' });
  }
});

// 파트너 본인의 설정 정보 업데이트
router.patch('/settings', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const partnerId = req.user!.userId;
  const { pricePerKg, useBizMessage } = req.body;
  
  try {
    const updatedPartner = await prisma.user.update({
      where: { id: partnerId },
      data: { 
        pricePerKg: pricePerKg !== undefined ? Number(pricePerKg) : undefined,
        useBizMessage: useBizMessage !== undefined ? Boolean(useBizMessage) : undefined
      },
      select: { pricePerKg: true, useBizMessage: true }
    });
    
    res.json({ message: '환경 설정이 저장되었습니다.', settings: updatedPartner });
  } catch (error) {
    console.error('환경 설정 업데이트 에러:', error);
    res.status(500).json({ error: '환경 설정 업데이트에 실패했습니다.' });
  }
});

export default router;

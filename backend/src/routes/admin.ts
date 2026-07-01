import express from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { validatePartner, validateDriver } from '../middleware/validateMiddleware';
import { getStatusForAction } from '../services/statusService';
import { getCoordinates } from '../services/kakaoRoute';
import { sendAssignmentToCustomer, sendScheduleConfirmedToCustomer } from '../services/notificationService';
import { updateRequestStatusInSheet, addRequestToSheet } from '../services/googleSheets';
import { sendDriverAssignedSystemMessage } from '../socket';

const router = express.Router();

// 유클리드 거리 계산 헬퍼
function getDistance(x1: number, y1: number, x2: number, y2: number) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// 용량 제한 기반 지리적 클러스터 생성 함수
function createClusters(destinations: any[], startX: number, startY: number, maxPerCluster: number) {
  let unvisited = [...destinations];
  let clusters: any[][] = [];
  let currentX = startX;
  let currentY = startY;

  while (unvisited.length > 0) {
    let cluster: any[] = [];
    let cx = currentX;
    let cy = currentY;

    for (let i = 0; i < maxPerCluster && unvisited.length > 0; i++) {
      let minDist = Infinity;
      let nextIdx = 0;
      for (let j = 0; j < unvisited.length; j++) {
        let dist = getDistance(unvisited[j].x, unvisited[j].y, cx, cy);
        if (dist < minDist) {
          minDist = dist;
          nextIdx = j;
        }
      }
      let target = unvisited.splice(nextIdx, 1)[0];
      cluster.push(target);
      cx = target.x;
      cy = target.y;
    }
    clusters.push(cluster);
    currentX = cx;
    currentY = cy;
  }
  return clusters;
}

// ==========================================
// [SUPER_ADMIN 전용] 플랫폼 관리 기능
// ==========================================

// 1. 전체 지역 파트너(업체 사장님) 목록 및 신청 내역 조회
router.get('/partners', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    const users = await prisma.user.findMany({
      where: { 
        role: 'PARTNER',
        NOT: { name: { contains: '데모' } }
      },
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

// 4. 파트너 계정 강제 삭제 (관련 데이터 연쇄 삭제 및 초기화)
router.delete('/partners/:id', authenticate, requireRole(['SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    // 1. 담당 권역(Coverage) 삭제
    await prisma.coverage.deleteMany({ where: { partnerId: id } });
    
    // 2. 사장님이 직접 등록한 CustomRegion 삭제
    await prisma.customRegion.deleteMany({ where: { partnerId: id } });

    // 3. 소속 기사들(DriverProfile 및 해당 기사의 User 계정) 삭제
    const drivers = await prisma.driverProfile.findMany({ where: { partnerId: id } });
    for (const d of drivers) {
      await prisma.driverProfile.delete({ where: { id: d.id } });
      await prisma.user.delete({ where: { id: d.userId } });
    }

    // 4. 파트너에게 배정된 수거 요청 건 처리
    await prisma.request.updateMany({
      where: { partnerId: id, status: { not: 'COMPLETED' } },
      data: { partnerId: null, driverId: null, status: 'PENDING' }
    });
    await prisma.request.updateMany({
      where: { partnerId: id, status: 'COMPLETED' },
      data: { partnerId: null, driverId: null }
    });

    // 5. 채팅방 및 메시지 삭제
    const rooms = await prisma.chatRoom.findMany({ where: { partnerId: id } });
    for (const r of rooms) {
      await prisma.chatMessage.deleteMany({ where: { roomId: r.id } });
      await prisma.chatRoom.delete({ where: { id: r.id } });
    }
    await prisma.chatMessage.deleteMany({ where: { senderId: id } });

    // 6. 파트너 계정 최종 삭제
    await prisma.user.delete({ where: { id, role: 'PARTNER' } });

    res.json({ message: '파트너 계정이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('파트너 삭제 에러:', error);
    res.status(500).json({ error: '파트너 삭제 중 서버 오류가 발생했습니다.' });
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // 파트너가 담당하는 권역 정보 가져오기
    const coverages = await prisma.coverage.findMany({
      where: { partnerId },
      include: { region: true }
    });

    let requests;
    let totalCount = 0;

    if (coverages.length === 0) {
      // 권역 미설정 → 전체 지역의 미배정 요청 + 본인에게 이미 배정된 요청
      const whereCondition = {
        OR: [
          { partnerId: null, status: 'PENDING' },
          { partnerId: partnerId }
        ]
      };
      
      totalCount = await prisma.request.count({ where: whereCondition });
      requests = await prisma.request.findMany({
        where: whereCondition,
        include: { driver: { include: { user: true } }, collectionItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });
    } else {
      // 권역 설정됨 → 해당 시(city)의 주소를 가진 미배정 요청 + 본인 배정 건
      const cities = coverages.map((c: any) => c.region.city);
      const cityFilters = cities.map((city: string) => ({ address: { contains: city } }));
      
      const whereCondition = {
        OR: [
          { partnerId: null, status: 'PENDING', OR: cityFilters },
          { partnerId: partnerId }
        ]
      };

      totalCount = await prisma.request.count({ where: whereCondition });
      requests = await prisma.request.findMany({
        where: whereCondition,
        include: { driver: { include: { user: true } }, collectionItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });
    }
    
    const totalPages = Math.ceil(totalCount / limit);
    res.json({ requests, totalPages, currentPage: page, totalCount });
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

    // 구글 시트 상태 연동
    updateRequestStatusInSheet(id, 'ASSIGNED').catch(err => console.error('시트 상태 업데이트 실패 (비동기):', err));

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

    // 구글 시트 상태 연동
    updateRequestStatusInSheet(id, 'PENDING').catch(err => console.error('시트 상태 업데이트 실패 (비동기):', err));

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

// 개별 수거 요청 강제 삭제
router.delete('/requests/:id', authenticate, requireRole(['SUPER_ADMIN', 'PARTNER']), async (req: any, res: any) => {
  const { id } = req.params;
  
  try {
    const existingRequest = await prisma.request.findUnique({ where: { id } });
    if (!existingRequest) {
      return res.status(404).json({ error: '수거 요청을 찾을 수 없습니다.' });
    }

    // Google Sheets 연동되어 있다면 삭제 표시(상태 업데이트로 우회하거나 시트 지원 안하면 무시)
    // 현재는 DB 삭제만 진행
    await prisma.request.delete({
      where: { id }
    });

    res.json({ message: '수거 요청이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('수거 요청 삭제 오류:', error);
    res.status(500).json({ error: '수거 요청 삭제 중 오류가 발생했습니다.' });
  }
});

// 예상 수거 시간 업데이트
router.patch('/requests/:id/estimated-time', authenticate, requireRole(['SUPER_ADMIN', 'PARTNER']), async (req: any, res: any) => {
  const { id } = req.params;
  const { estimatedPickupHour } = req.body;
  
  try {
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { estimatedPickupHour }
    });
    res.json({ message: '예상 수거 시간이 업데이트되었습니다.', request: updatedRequest });
  } catch (error) {
    console.error('예상 수거 시간 업데이트 오류:', error);
    res.status(500).json({ error: '업데이트 중 오류가 발생했습니다.' });
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
    const existingReq = await prisma.request.findUnique({ where: { id: requestId } });
    if (!existingReq) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });

    const request = await prisma.request.update({
      where: { id: requestId },
      data: {
        driverId,
        status: getStatusForAction.onDriverAssigned(),
        confirmedDate: confirmedDate ? new Date(confirmedDate) : (existingReq.confirmedDate || existingReq.desiredDate)
      },
      include: { partner: true }
    });

    // 구글 시트 상태 연동
    updateRequestStatusInSheet(requestId, getStatusForAction.onDriverAssigned()).catch(err => console.error('시트 상태 업데이트 실패 (비동기):', err));

    // 기사 전화번호 및 알림톡 발송
    let driverPhone = undefined;
    if (request.driverId) {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { id: request.driverId }, include: { user: true }});
      if (driverProfile && driverProfile.user.phone) {
        driverPhone = driverProfile.user.phone;
      }
    }

    // 일정 확정 안내 알림톡 발송 (비동기)
    if (request.partner && request.partner.useBizMessage && request.confirmedDate) {
      sendScheduleConfirmedToCustomer(
        request.phone,
        request.userName,
        request.confirmedDate,
        request.partner.useBizMessage,
        driverPhone
      ).catch(err => console.error('일정 확정 알림톡 전송 실패:', err));
    }

    // 채팅 자동 응답 발송 (비동기)
    if (request.customerId && request.partnerId && driverPhone) {
      // confirmedDate가 아직 null일 수 있으므로 any로 안전하게 넘기거나, schema상 Date|null로 처리
      sendDriverAssignedSystemMessage(
        request.customerId,
        request.partnerId,
        driverPhone,
        request.confirmedDate as Date
      );
    }

    res.json({ message: '기사 배정이 완료되었습니다.', request });
  } catch (error) {
    res.status(500).json({ error: '기사 배정 실패' });
  }
});

// 3-0. 특정 수거 건의 실제 방문 날짜(confirmedDate) 임의 변경 (동선 최적화용)
router.patch('/requests/:id/date', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const { id } = req.params;
  const { confirmedDate } = req.body;
  const partnerId = req.user!.userId;

  try {
    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: '수거 신청을 찾을 수 없습니다.' });
    }

    // 본인 배정 건이거나 SUPER_ADMIN인지 체크 (여기선 간략히 체크)
    if (req.user.role === 'PARTNER' && request.partnerId !== partnerId) {
       return res.status(403).json({ error: '본인에게 배정된 건만 수정할 수 있습니다.' });
    }

    const updated = await prisma.request.update({
      where: { id },
      data: { confirmedDate: new Date(confirmedDate) }
    });

    res.json({ message: '방문 확정일이 변경되었습니다.', request: updated });
  } catch (error) {
    console.error('날짜 변경 에러:', error);
    res.status(500).json({ error: '날짜 변경에 실패했습니다.' });
  }
});

// 3-1-2. 수거 신청건 다중 일괄 변경 (기사 배정 및 방문 확정일 변경)
router.post('/requests/batch-update', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const { requestIds, driverId, confirmedDate } = req.body;
  
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({ error: '변경할 수거 건을 선택해주세요.' });
  }
  if (!driverId && !confirmedDate) {
    return res.status(400).json({ error: '기사 배정 또는 방문 확정일 중 하나 이상을 입력해주세요.' });
  }

  try {
    const partnerId = req.user!.userId;
    const isAdmin = req.user!.role === 'SUPER_ADMIN';

    // 권한 확인: SUPER_ADMIN은 모두 허용, PARTNER는 본인 건만 허용
    const whereClause = isAdmin ? { id: { in: requestIds } } : { id: { in: requestIds }, partnerId };
    
    const requests = await prisma.request.findMany({
      where: whereClause,
      include: { partner: true }
    });

    if (requests.length === 0) {
      return res.status(403).json({ error: '권한이 없거나 찾을 수 없는 요청들입니다.' });
    }

    const validIds = requests.map(r => r.id);
    const updateData: any = {};
    
    if (confirmedDate) {
      updateData.confirmedDate = new Date(confirmedDate);
    }
    if (driverId) {
      updateData.driverId = driverId;
      updateData.status = getStatusForAction.onDriverAssigned();
    }

    const updatePromises = requestIds.map((id, index) => {
      if (!validIds.includes(id)) return null;
      const data = { ...updateData };
      if (driverId) {
        data.orderIndex = index + 1;
      }
      return prisma.request.update({
        where: { id },
        data
      });
    }).filter(Boolean);

    await prisma.$transaction(updatePromises as any);

    if (driverId) {
      // 구글 시트 비동기 업데이트
      validIds.forEach(id => {
        updateRequestStatusInSheet(id, getStatusForAction.onDriverAssigned()).catch(err => console.error('시트 상태 업데이트 실패:', err));
      });

      // 채팅 자동 응답 일괄 발송 및 알림톡
      try {
        const driverProfile = await prisma.driverProfile.findUnique({ where: { id: driverId }, include: { user: true }});
        const driverPhone = driverProfile?.user?.phone || undefined;
        
        requests.forEach(req => {
          // 기사가 배정되고 날짜도 확정된 경우 알림톡 발송
          if (confirmedDate && req.partner?.useBizMessage) {
            sendScheduleConfirmedToCustomer(
              req.phone,
              req.userName,
              new Date(confirmedDate),
              req.partner.useBizMessage,
              driverPhone
            ).catch(err => console.error('일정 확정 알림톡 전송 실패:', err));
          }

          if (req.customerId && req.partnerId && driverPhone) {
            sendDriverAssignedSystemMessage(
              req.customerId,
              req.partnerId,
              driverPhone,
              (confirmedDate ? new Date(confirmedDate) : req.confirmedDate) as Date
            );
          }
        });
      } catch (e) {
        console.error('채팅/알림톡 일괄 발송 에러:', e);
      }
    }

    res.json({ message: `${validIds.length}건이 일괄 변경되었습니다.` });
  } catch (error) {
    console.error('일괄 변경 에러:', error);
    res.status(500).json({ error: '일괄 변경 중 오류가 발생했습니다.' });
  }
});

// 3-1. 기사에게 수거 신청건 다중 일괄 배정 (지도 기반 등)
router.post('/requests/batch-assign-driver', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  const { requestIds, driverId } = req.body;
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({ error: '배정할 수거 건을 선택해주세요.' });
  }

  try {
    const partnerId = req.user!.userId;

    // 권한 확인: 본인의 파트너 ID가 매칭되는 건만 필터링
    const requests = await prisma.request.findMany({
      where: { id: { in: requestIds }, partnerId }
    });

    if (requests.length === 0) {
      return res.status(403).json({ error: '권한이 없거나 찾을 수 없는 요청들입니다.' });
    }

    const validIds = requests.map(r => r.id);

    // 각 요청에 대해 orderIndex를 순차적으로 부여 (전달된 requestIds 순서 기준)
    const updatePromises = requestIds.map((id, index) => {
      if (!validIds.includes(id)) return null;
      const existingReq = requests.find(r => r.id === id);
      return prisma.request.update({
        where: { id },
        data: {
          driverId,
          status: getStatusForAction.onDriverAssigned(),
          orderIndex: index + 1,
          confirmedDate: existingReq?.confirmedDate || existingReq?.desiredDate
        }
      });
    }).filter(Boolean);

    await prisma.$transaction(updatePromises as any);

    // 구글 시트 비동기 업데이트
    validIds.forEach(id => {
      updateRequestStatusInSheet(id, getStatusForAction.onDriverAssigned()).catch(err => console.error('시트 상태 업데이트 실패:', err));
    });

    // 채팅 자동 응답 일괄 발송
    try {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { id: driverId }, include: { user: true }});
      const driverPhone = driverProfile?.user.phone;
      
      if (driverPhone) {
        requests.forEach(req => {
          if (req.customerId && req.partnerId) {
            sendDriverAssignedSystemMessage(
              req.customerId,
              req.partnerId,
              driverPhone,
              req.confirmedDate as Date
            );
          }
        });
      }
    } catch (e) {
      console.error('채팅 일괄 자동 발송 에러:', e);
    }

    res.json({ message: `${validIds.length}건이 기사에게 일괄 배정되었습니다.` });
  } catch (error) {
    console.error('일괄 기사 배정 에러:', error);
    res.status(500).json({ error: '일괄 기사 배정 중 오류가 발생했습니다.' });
  }
});

// 3-2. 특정 기사의 수거 목록 순서 수동 변경 (Custom Reordering)
router.post('/requests/reorder', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  const { requestIds } = req.body;
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({ error: '순서를 변경할 요청 ID 목록이 필요합니다.' });
  }

  try {
    const partnerId = req.user!.userId;

    // 본인 권한 소속인지 검증 (성능을 위해 count 사용)
    const validCount = await prisma.request.count({
      where: { id: { in: requestIds }, partnerId }
    });

    if (validCount !== requestIds.length) {
      return res.status(403).json({ error: '권한이 없거나 찾을 수 없는 요청이 포함되어 있습니다.' });
    }

    // 트랜잭션으로 일괄 업데이트
    await prisma.$transaction(
      requestIds.map((id, index) =>
        prisma.request.update({
          where: { id },
          data: { orderIndex: index }
        })
      )
    );

    res.json({ message: '순서가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('순서 변경 에러:', error);
    res.status(500).json({ error: '순서 변경 중 오류가 발생했습니다.' });
  }
});

// 3-3. 특정 기사의 동선 최적화 (카카오/T맵 좌표 API 기반 첫번째 수거지 출발 정렬)
router.post('/drivers/:driverId/optimize-route', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  const { driverId } = req.params;
  const partnerId = req.user!.userId;

  try {
    // 기사 프로필 확인
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId }
    });
    // 파트너 본인의 기사인지 확인
    if (!driver || driver.partnerId !== partnerId) {
      return res.status(403).json({ error: '권한이 없거나 기사 프로필을 찾을 수 없습니다.' });
    }

    // 기사에게 배정된 미완료 수거 건 조회
    const requests = await prisma.request.findMany({
      where: { driverId: driver.id, status: { not: 'COMPLETED' }, partnerId }
    });

    if (requests.length <= 1) {
      return res.json({ message: '수거 건수가 적어 동선 최적화가 필요하지 않습니다.', requests });
    }

    // 각 수거지의 좌표 변환
    const destinations: any[] = [];
    for (const r of requests) {
      const coords = await getCoordinates(r.address);
      if (coords) {
        destinations.push({
          request: r,
          x: parseFloat(coords.x),
          y: parseFloat(coords.y)
        });
      }
    }

    if (destinations.length === 0) {
      return res.status(400).json({ error: '주소의 좌표를 찾을 수 없습니다.' });
    }

    // 출발지를 첫 번째 수거지의 위치로 설정
    const currentLat = destinations[0].y;
    const currentLng = destinations[0].x;

    // T맵 API 키 확인
    const tmapAppKey = process.env.TMAP_APP_KEY;
    let optimizedList: any[] = [];

    let totalTimeSec = 0;
    let totalDistanceMeter = 0;
    let usedTmap = false;

    if (tmapAppKey && tmapAppKey.length > 0) {
      try {
        const clusters = createClusters(destinations, currentLng, currentLat, 20);
        let currentStartX = currentLng;
        let currentStartY = currentLat;

        for (const cluster of clusters) {
          if (cluster.length === 0) continue;

          const clusterDest = cluster[cluster.length - 1];
          const payload = {
            reqCoordType: "WGS84GEO",
            resCoordType: "WGS84GEO",
            startName: "출발지",
            startX: currentStartX.toString(),
            startY: currentStartY.toString(),
            startTime: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12),
            endName: "도착지",
            endX: clusterDest.x.toString(),
            endY: clusterDest.y.toString(),
            searchOption: "0", 
            viaPoints: cluster.map((d: any, i: number) => ({
              viaPointId: d.request.id,
              viaPointName: encodeURIComponent(d.request.userName || `수거지${i+1}`).substring(0, 20),
              viaX: d.x.toString(),
              viaY: d.y.toString()
            }))
          };

          const tmapRes = await axios.post(
            'https://apis.openapi.sk.com/tmap/routes/routeOptimization20?version=1',
            payload,
            { headers: { appKey: tmapAppKey, 'Content-Type': 'application/json' } }
          );

          if (tmapRes.data && tmapRes.data.properties && tmapRes.data.features) {
            totalTimeSec += tmapRes.data.properties.totalTime || 0;
            totalDistanceMeter += tmapRes.data.properties.totalDistance || 0;
            usedTmap = true;

            const features = tmapRes.data.features;
            const orderedVias = features.filter((f: any) => f.properties && f.properties.viaPointId);
            
            for (const via of orderedVias) {
              const dest = cluster.find((d: any) => d.request.id === via.properties.viaPointId);
              if (dest && !optimizedList.find(r => r.id === dest.request.id)) {
                optimizedList.push(dest.request);
              }
            }
            
            for (const dest of cluster) {
              if (!optimizedList.find(r => r.id === dest.request.id)) {
                optimizedList.push(dest.request);
              }
            }

            const lastProcessed = optimizedList[optimizedList.length - 1];
            const lastDestCoords = cluster.find((d: any) => d.request.id === lastProcessed.id);
            if (lastDestCoords) {
              currentStartX = lastDestCoords.x;
              currentStartY = lastDestCoords.y;
            }
          } else {
            throw new Error('T맵 응답 형식 오류');
          }
        }
      } catch (tmapError: any) {
        console.error('T맵 API 호출 실패, 유클리드 거리로 폴백:', tmapError.message);
        optimizedList = [];
        usedTmap = false;
        totalTimeSec = 0;
        totalDistanceMeter = 0;
      }
    }

    if (optimizedList.length === 0) {
      const startX = currentLng;
      const startY = currentLat;
      
      const unvisited = [...destinations];
      let route: any[] = [];
      let cx = startX;
      let cy = startY;

      while (unvisited.length > 0) {
        let minDistance = Infinity;
        let nextIndex = 0;
        for (let i = 0; i < unvisited.length; i++) {
          const dx = unvisited[i].x - cx;
          const dy = unvisited[i].y - cy;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < minDistance) {
            minDistance = distance;
            nextIndex = i;
          }
        }
        const nextTarget = unvisited.splice(nextIndex, 1)[0];
        route.push(nextTarget);
        cx = nextTarget.x;
        cy = nextTarget.y;
      }

      let improved = true;
      let iterations = 0;
      while (improved && iterations < 1000) {
        improved = false;
        iterations++;
        for (let i = 0; i < route.length - 1; i++) {
          for (let k = i + 1; k < route.length; k++) {
            const node_i_minus_1 = i === 0 ? { x: startX, y: startY } : route[i - 1];
            const node_i = route[i];
            const node_k = route[k];
            const node_k_plus_1 = k === route.length - 1 ? null : route[k + 1];

            const d1 = Math.sqrt(Math.pow(node_i_minus_1.x - node_i.x, 2) + Math.pow(node_i_minus_1.y - node_i.y, 2));
            const d2 = node_k_plus_1 ? Math.sqrt(Math.pow(node_k.x - node_k_plus_1.x, 2) + Math.pow(node_k.y - node_k_plus_1.y, 2)) : 0;
            
            const new_d1 = Math.sqrt(Math.pow(node_i_minus_1.x - node_k.x, 2) + Math.pow(node_i_minus_1.y - node_k.y, 2));
            const new_d2 = node_k_plus_1 ? Math.sqrt(Math.pow(node_i.x - node_k_plus_1.x, 2) + Math.pow(node_i.y - node_k_plus_1.y, 2)) : 0;

            if (new_d1 + new_d2 < d1 + d2 - 0.0000001) {
              const segment = route.slice(i, k + 1).reverse();
              route.splice(i, segment.length, ...segment);
              improved = true;
            }
          }
        }
      }

      optimizedList = route.map(r => r.request);
    }

    // 데이터베이스에 정렬된 orderIndex 일괄 업데이트
    await prisma.$transaction(
      optimizedList.map((reqItem, idx) =>
        prisma.request.update({
          where: { id: reqItem.id },
          data: { orderIndex: idx }
        })
      )
    );

    // 변경된 요청 목록을 순서대로 다시 반환
    const updatedRequests = await prisma.request.findMany({
      where: { driverId: driver.id, status: { not: 'COMPLETED' }, partnerId },
      orderBy: { orderIndex: 'asc' }
    });

    res.json({ message: '동선 최적화가 완료되었습니다!', requests: updatedRequests });
  } catch (error) {
    console.error('관리자 동선 최적화 에러:', error);
    res.status(500).json({ error: '동선 최적화 중 오류가 발생했습니다.' });
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

    // 구글 시트 상태 연동
    updateRequestStatusInSheet(id, 'ASSIGNED').catch(err => console.error('시트 상태 업데이트 실패 (비동기):', err));

    res.json({ message: '기사 배정이 취소되었습니다.', request: updated });
  } catch (error) {
    console.error('배정 취소 에러:', error);
    res.status(500).json({ error: '배정 취소 중 오류가 발생했습니다.' });
  }
});

// 4-1. 일괄 배정 취소
router.post('/requests/batch-unassign', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '취소할 수거 건을 선택해주세요.' });
  }

  try {
    const partnerId = req.user!.userId;
    
    // 권한 확인: 본인의 파트너 ID가 매칭되는 건만 필터링
    const requests = await prisma.request.findMany({
      where: { id: { in: ids }, partnerId }
    });

    if (requests.length === 0) {
      return res.status(403).json({ error: '권한이 없거나 찾을 수 없는 요청들입니다.' });
    }

    const validIds = requests.map(r => r.id);

    const updatedResult = await prisma.request.updateMany({
      where: { id: { in: validIds } },
      data: {
        driverId: null,
        status: 'ASSIGNED',
        confirmedDate: null,
        etaMinutes: null
      }
    });

    // 구글 시트 비동기 업데이트 (각각 실행)
    validIds.forEach(id => {
      updateRequestStatusInSheet(id, 'ASSIGNED').catch(err => console.error('시트 상태 업데이트 실패:', err));
    });

    res.json({ message: `${updatedResult.count}건의 배정이 취소되었습니다.` });
  } catch (error) {
    console.error('일괄 배정 취소 에러:', error);
    res.status(500).json({ error: '일괄 배정 취소 중 오류가 발생했습니다.' });
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

// 기사 삭제
router.delete('/drivers/:id', authenticate, requireRole(['PARTNER']), async (req: any, res: any) => {
  try {
    const partnerId = req.user!.userId;
    const driverId = req.params.id;

    // 본인 소속 기사인지 확인
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId }
    });
    
    if (!driver || driver.partnerId !== partnerId) {
      return res.status(403).json({ error: '권한이 없거나 존재하지 않는 기사입니다.' });
    }

    // 기사에게 배정된 수거 건을 미배정 상태로 변경 (status는 뷰에 따라 유동적일 수 있으나 기본적으로 유지하거나 ASSIGNED로 변경)
    await prisma.request.updateMany({
      where: { driverId: driverId, status: { not: 'COMPLETED' } },
      data: {
        driverId: null,
        status: 'ASSIGNED',
        confirmedDate: null,
        etaMinutes: null
      }
    });

    // 완료된 건이 있을 수 있으므로 단순히 driverId만 null 처리
    await prisma.request.updateMany({
      where: { driverId: driverId, status: 'COMPLETED' },
      data: {
        driverId: null
      }
    });

    // 사장님 본인 계정인 경우 User는 놔두고 DriverProfile만 삭제
    if (driver.userId === partnerId) {
      await prisma.driverProfile.delete({ where: { id: driverId } });
    } else {
      await prisma.driverProfile.delete({ where: { id: driverId } });
      await prisma.user.delete({ where: { id: driver.userId } });
    }

    res.json({ message: '기사가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('기사 삭제 에러:', error);
    res.status(500).json({ error: '기사 삭제 중 오류가 발생했습니다.' });
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
    const demoNames = ['김민준', '이서연', '박도윤', '최서윤', '정하준', '강지우', '조서진', '윤하은', '장지호', '임지아', 
               '한은우', '오민서', '서윤우', '신채원', '권우진', '황수아', '안건우', '송지율', '유연우', '홍다은', '테스트', '수동접수'];

    // 1. 전체 수거 건 통계 (더미 데이터 제외)
    const allRequestsRaw = await prisma.request.findMany({
      include: { partner: true },
      orderBy: { createdAt: 'desc' }
    });

    // 더미데이터 필터링: seed_demo 이름이면서 비회원(customerId 없음)이거나 이름에 '테스트' 포함
    const allRequests = allRequestsRaw.filter((r: any) => {
      const isDemoName = demoNames.includes(r.userName) && !r.customerId;
      const hasTestInName = r.userName.includes('테스트');
      return !isDemoName && !hasTestInName;
    });

    const total = allRequests.length;
    const completed = allRequests.filter((r: any) => r.status === 'COMPLETED');
    const totalWeight = completed.reduce((s: number, r: any) => s + (r.actualWeight || 0), 0);

    // 2. 파트너별 성과 (수거 건수, 완료율, 총 무게)
    // 데모 파트너 제외
    const partners = await prisma.user.findMany({
      where: { 
        role: 'PARTNER',
        NOT: { name: { contains: '데모' } }
      },
      select: { id: true, name: true, businessName: true }
    });

    const partnerStats = partners.map((p: any) => {
      const pRequests = allRequests.filter((r: any) => r.partnerId === p.id);
      const pCompleted = pRequests.filter((r: any) => r.status === 'COMPLETED');
      const pWeight = pCompleted.reduce((s: number, r: any) => s + (r.actualWeight || 0), 0);
      const manualCount = pRequests.filter((r: any) => !r.customerId).length;
      const customerCount = pRequests.filter((r: any) => r.customerId).length;
      
      const statsByMonth: Record<string, { requests: number, completed: number, weight: number, manual: number, customer: number }> = {};
      pRequests.forEach((r: any) => {
        // 정산 기준일: 수거 완료일이 있으면 완료일, 없으면 접수일
        const dateToUse = r.completedDate ? new Date(r.completedDate) : new Date(r.createdAt);
        const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
        
        if (!statsByMonth[monthKey]) {
          statsByMonth[monthKey] = { requests: 0, completed: 0, weight: 0, manual: 0, customer: 0 };
        }
        statsByMonth[monthKey].requests += 1;
        if (!r.customerId) statsByMonth[monthKey].manual += 1;
        if (r.customerId) statsByMonth[monthKey].customer += 1;
        
        if (r.status === 'COMPLETED') {
          statsByMonth[monthKey].completed += 1;
          statsByMonth[monthKey].weight += (r.actualWeight || 0);
        }
      });

      return {
        id: p.id,
        name: p.businessName || p.name,
        totalRequests: pRequests.length,
        completedCount: pCompleted.length,
        completionRate: pRequests.length > 0 ? Math.round((pCompleted.length / pRequests.length) * 100) : 0,
        totalWeight: Math.round(pWeight * 10) / 10,
        manualCount,
        customerCount,
        statsByMonth
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
router.post('/debug/seed-suwon', async (req, res) => {
  try {
    const realAddresses = [
      // 수원시
      { address: "경기도 수원시 장안구 조원동 893", sigungu: "수원시 장안구", bname: "조원동", city: "수원시" },
      { address: "경기도 수원시 권선구 권선동 1234", sigungu: "수원시 권선구", bname: "권선동", city: "수원시" },
      { address: "경기도 수원시 팔달구 매산로1가 18", sigungu: "수원시 팔달구", bname: "매산로1가", city: "수원시" },
      { address: "경기도 수원시 영통구 원천동 593", sigungu: "수원시 영통구", bname: "원천동", city: "수원시" },
      { address: "경기도 수원시 장안구 송죽동 382-6", sigungu: "수원시 장안구", bname: "송죽동", city: "수원시" },
      { address: "경기도 수원시 권선구 탑동 903", sigungu: "수원시 권선구", bname: "탑동", city: "수원시" },
      { address: "경기도 수원시 팔달구 인계동 1111", sigungu: "수원시 팔달구", bname: "인계동", city: "수원시" },
      { address: "경기도 수원시 영통구 매탄동 1268", sigungu: "수원시 영통구", bname: "매탄동", city: "수원시" },
      { address: "경기도 수원시 팔달구 화서동 410-1", sigungu: "수원시 팔달구", bname: "화서동", city: "수원시" },
      { address: "경기도 수원시 권선구 세류동 1146", sigungu: "수원시 권선구", bname: "세류동", city: "수원시" },
      // 용인시
      { address: "경기도 용인시 처인구 삼가동 556", sigungu: "용인시 처인구", bname: "삼가동", city: "용인시" },
      { address: "경기도 용인시 기흥구 구갈동 358-6", sigungu: "용인시 기흥구", bname: "구갈동", city: "용인시" },
      { address: "경기도 용인시 수지구 풍덕천동 720", sigungu: "용인시 수지구", bname: "풍덕천동", city: "용인시" },
      { address: "경기도 용인시 기흥구 보정동 1264", sigungu: "용인시 기흥구", bname: "보정동", city: "용인시" },
      { address: "경기도 용인시 수지구 동천동 899", sigungu: "용인시 수지구", bname: "동천동", city: "용인시" },
      { address: "경기도 용인시 처인구 역북동 754", sigungu: "용인시 처인구", bname: "역북동", city: "용인시" },
      { address: "경기도 용인시 기흥구 신갈동 58", sigungu: "용인시 기흥구", bname: "신갈동", city: "용인시" },
      { address: "경기도 용인시 기흥구 마북동 524", sigungu: "용인시 기흥구", bname: "마북동", city: "용인시" },
      { address: "경기도 용인시 수지구 상현동 254", sigungu: "용인시 수지구", bname: "상현동", city: "용인시" },
      { address: "경기도 용인시 처인구 고림동 502", sigungu: "용인시 처인구", bname: "고림동", city: "용인시" },
      // 성남시
      { address: "경기도 성남시 수정구 태평동 7288", sigungu: "성남시 수정구", bname: "태평동", city: "성남시" },
      { address: "경기도 성남시 중원구 성남동 4165", sigungu: "성남시 중원구", bname: "성남동", city: "성남시" },
      { address: "경기도 성남시 분당구 야탑동 341", sigungu: "성남시 분당구", bname: "야탑동", city: "성남시" },
      { address: "경기도 성남시 분당구 서현동 256", sigungu: "성남시 분당구", bname: "서현동", city: "성남시" },
      { address: "경기도 성남시 분당구 정자동 178", sigungu: "성남시 분당구", bname: "정자동", city: "성남시" },
      { address: "경기도 성남시 수정구 수진동 2959", sigungu: "성남시 수정구", bname: "수진동", city: "성남시" },
      { address: "경기도 성남시 중원구 금광동 140", sigungu: "성남시 중원구", bname: "금광동", city: "성남시" },
      { address: "경기도 성남시 분당구 백현동 541", sigungu: "성남시 분당구", bname: "백현동", city: "성남시" },
      { address: "경기도 성남시 분당구 판교동 595", sigungu: "성남시 분당구", bname: "판교동", city: "성남시" },
      { address: "경기도 성남시 수정구 신흥동 2465", sigungu: "성남시 수정구", bname: "신흥동", city: "성남시" },
      // 고양시
      { address: "경기도 고양시 덕양구 화정동 963", sigungu: "고양시 덕양구", bname: "화정동", city: "고양시" },
      { address: "경기도 고양시 일산동구 마두동 812", sigungu: "고양시 일산동구", bname: "마두동", city: "고양시" },
      { address: "경기도 고양시 일산서구 대화동 2605", sigungu: "고양시 일산서구", bname: "대화동", city: "고양시" },
      { address: "경기도 고양시 덕양구 행신동 995", sigungu: "고양시 덕양구", bname: "행신동", city: "고양시" },
      { address: "경기도 고양시 일산동구 장항동 906", sigungu: "고양시 일산동구", bname: "장항동", city: "고양시" },
      { address: "경기도 고양시 일산서구 주엽동 109", sigungu: "고양시 일산서구", bname: "주엽동", city: "고양시" },
      { address: "경기도 고양시 덕양구 성사동 704", sigungu: "고양시 덕양구", bname: "성사동", city: "고양시" },
      { address: "경기도 고양시 일산동구 정발산동 1248", sigungu: "고양시 일산동구", bname: "정발산동", city: "고양시" },
      { address: "경기도 고양시 일산서구 탄현동 1640", sigungu: "고양시 일산서구", bname: "탄현동", city: "고양시" },
      { address: "경기도 고양시 덕양구 토당동 856", sigungu: "고양시 덕양구", bname: "토당동", city: "고양시" },
      // 안양시
      { address: "경기도 안양시 만안구 안양동 622-26", sigungu: "안양시 만안구", bname: "안양동", city: "안양시" },
      { address: "경기도 안양시 동안구 호계동 1039-3", sigungu: "안양시 동안구", bname: "호계동", city: "안양시" },
      { address: "경기도 안양시 동안구 평촌동 895", sigungu: "안양시 동안구", bname: "평촌동", city: "안양시" },
      { address: "경기도 안양시 만안구 석수동 260", sigungu: "안양시 만안구", bname: "석수동", city: "안양시" },
      { address: "경기도 안양시 만안구 박달동 68-1", sigungu: "안양시 만안구", bname: "박달동", city: "안양시" },
      { address: "경기도 안양시 동안구 비산동 1115", sigungu: "안양시 동안구", bname: "비산동", city: "안양시" },
      { address: "경기도 안양시 동안구 관양동 1587", sigungu: "안양시 동안구", bname: "관양동", city: "안양시" },
      { address: "경기도 안양시 만안구 안양동 707-285", sigungu: "안양시 만안구", bname: "안양동", city: "안양시" },
      { address: "경기도 안양시 동안구 호계동 1051", sigungu: "안양시 동안구", bname: "호계동", city: "안양시" },
      { address: "경기도 안양시 동안구 비산동 1111", sigungu: "안양시 동안구", bname: "비산동", city: "안양시" },
      // 안산시
      { address: "경기도 안산시 단원구 고잔동 528", sigungu: "안산시 단원구", bname: "고잔동", city: "안산시" },
      { address: "경기도 안산시 상록구 사동 1271", sigungu: "안산시 상록구", bname: "사동", city: "안산시" },
      { address: "경기도 안산시 단원구 초지동 666", sigungu: "안산시 단원구", bname: "초지동", city: "안산시" },
      { address: "경기도 안산시 상록구 본오동 871", sigungu: "안산시 상록구", bname: "본오동", city: "안산시" },
      { address: "경기도 안산시 단원구 선부동 1070", sigungu: "안산시 단원구", bname: "선부동", city: "안산시" },
      { address: "경기도 안산시 상록구 성포동 593", sigungu: "안산시 상록구", bname: "성포동", city: "안산시" },
      { address: "경기도 안산시 단원구 와동 836", sigungu: "안산시 단원구", bname: "와동", city: "안산시" },
      { address: "경기도 안산시 상록구 일동 651", sigungu: "안산시 상록구", bname: "일동", city: "안산시" },
      { address: "경기도 안산시 단원구 신길동 1686", sigungu: "안산시 단원구", bname: "신길동", city: "안산시" },
      { address: "경기도 안산시 상록구 월피동 508", sigungu: "안산시 상록구", bname: "월피동", city: "안산시" },
      // 부천시
      { address: "경기도 부천시 원미구 중동 1156", sigungu: "부천시 원미구", bname: "중동", city: "부천시" },
      { address: "경기도 부천시 원미구 상동 548-4", sigungu: "부천시 원미구", bname: "상동", city: "부천시" },
      { address: "경기도 부천시 소사구 송내동 387", sigungu: "부천시 소사구", bname: "송내동", city: "부천시" },
      { address: "경기도 부천시 오정구 오정동 736", sigungu: "부천시 오정구", bname: "오정동", city: "부천시" },
      { address: "경기도 부천시 소사구 역곡동 73-1", sigungu: "부천시 소사구", bname: "역곡동", city: "부천시" },
      { address: "경기도 부천시 원미구 심곡동 175-6", sigungu: "부천시 원미구", bname: "심곡동", city: "부천시" },
      { address: "경기도 부천시 오정구 고강동 302", sigungu: "부천시 오정구", bname: "고강동", city: "부천시" },
      { address: "경기도 부천시 소사구 심곡본동 544", sigungu: "부천시 소사구", bname: "심곡본동", city: "부천시" },
      { address: "경기도 부천시 원미구 춘의동 169", sigungu: "부천시 원미구", bname: "춘의동", city: "부천시" },
      { address: "경기도 부천시 오정구 원종동 281", sigungu: "부천시 오정구", bname: "원종동", city: "부천시" },
      // 광명시
      { address: "경기도 광명시 철산동 418", sigungu: "광명시", bname: "철산동", city: "광명시" },
      { address: "경기도 광명시 하안동 610", sigungu: "광명시", bname: "하안동", city: "광명시" },
      { address: "경기도 광명시 소하동 1344", sigungu: "광명시", bname: "소하동", city: "광명시" },
      { address: "경기도 광명시 광명동 158-970", sigungu: "광명시", bname: "광명동", city: "광명시" },
      { address: "경기도 광명시 일직동 500", sigungu: "광명시", bname: "일직동", city: "광명시" },
      { address: "경기도 광명시 철산동 442", sigungu: "광명시", bname: "철산동", city: "광명시" },
      { address: "경기도 광명시 하안동 63-4", sigungu: "광명시", bname: "하안동", city: "광명시" },
      { address: "경기도 광명시 소하동 1271", sigungu: "광명시", bname: "소하동", city: "광명시" },
      { address: "경기도 광명시 광명동 164", sigungu: "광명시", bname: "광명동", city: "광명시" },
      { address: "경기도 광명시 일직동 508", sigungu: "광명시", bname: "일직동", city: "광명시" }
    ];

    const names = ['김민준', '이서연', '박도윤', '최서윤', '정하준', '강지우', '조서진', '윤하은', '장지호', '임지아', 
                   '한은우', '오민서', '서윤우', '신채원', '권우진', '황수아', '안건우', '송지율', '유연우', '홍다은'];
    const volumes = ['헌옷 15kg', '헌옷 25kg, 신발 3켤레', '30kg 이상 (마대자루 2개)', '소량 (10kg 내외)', '옷 20kg, 가방 5개'];

    await prisma.request.deleteMany({});
    
    let count = 0;
    const requestDataToInsert = [];

    // 캐시용 Region 조회 맵
    const regionCache: Record<string, string> = {};

    for (const item of realAddresses) {
      if (!regionCache[item.city]) {
        let region = await prisma.region.findFirst({
          where: { province: '경기도', city: item.city, town: null }
        });
        if (!region) {
          region = await prisma.region.create({
            data: { province: '경기도', city: item.city, town: null }
          });
        }
        regionCache[item.city] = region.id;
      }

      requestDataToInsert.push({
        userName: names[Math.floor(Math.random() * names.length)],
        phone: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        address: item.address,
        detailAddress: Math.floor(Math.random() * 20 + 1) + '층',
        zipCode: '1' + Math.floor(1000 + Math.random() * 9000),
        sigungu: item.sigungu,
        bname: item.bname,
        desiredDate: new Date(),
        estimatedVolume: volumes[Math.floor(Math.random() * volumes.length)],
        status: 'PENDING',
        partnerId: null,
        regionId: regionCache[item.city],
      });
      count++;
    }
    
    await prisma.request.createMany({
      data: requestDataToInsert
    });

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
      select: { pricePerKg: true, useBizMessage: true, useCrmAutomation: true }
    });
    
    if (!partner) {
      return res.status(404).json({ error: '파트너 정보를 찾을 수 없습니다.' });
    }

    // 파트너별 커스텀 단가표 조회
    const priceItems = await prisma.partnerPriceItem.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'asc' }
    });
    
    res.json({ settings: partner, priceItems });
  } catch (error) {
    console.error('환경 설정 조회 에러:', error);
    res.status(500).json({ error: '환경 설정 조회에 실패했습니다.' });
  }
});

// 파트너 본인의 설정 정보 업데이트
router.patch('/settings', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const partnerId = req.user!.userId;
  const { pricePerKg, useBizMessage, useCrmAutomation } = req.body;
  
  try {
    const updatedPartner = await prisma.user.update({
      where: { id: partnerId },
      data: { 
        pricePerKg: pricePerKg !== undefined ? Number(pricePerKg) : undefined,
        useBizMessage: useBizMessage !== undefined ? Boolean(useBizMessage) : undefined,
        useCrmAutomation: useCrmAutomation !== undefined ? Boolean(useCrmAutomation) : undefined
      },
      select: { pricePerKg: true, useBizMessage: true, useCrmAutomation: true }
    });
    
    res.json({ message: '환경 설정이 저장되었습니다.', settings: updatedPartner });
  } catch (error) {
    console.error('환경 설정 저장 오류:', error);
    res.status(500).json({ message: '설정 저장 중 오류가 발생했습니다.' });
  }
});

// 파트너별 커스텀 단가표 일괄 저장 (upsert 방식)
// 왜 upsert인가: 카테고리가 이미 존재하면 업데이트, 없으면 생성
router.put('/price-table', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const partnerId = req.user!.userId;
  const { items } = req.body as {
    items: Array<{ category: string; label: string; unitPrice: number; unitType: string; icon: string }>
  };

  try {
    if (!items || items.length === 0) {
      return res.status(400).json({ error: '단가표 항목이 필요합니다.' });
    }

    // 트랜잭션으로 일괄 upsert (전체 단가표를 한 번에 저장)
    await prisma.$transaction(
      items.map(item =>
        prisma.partnerPriceItem.upsert({
          where: { partnerId_category: { partnerId, category: item.category } },
          update: {
            label: item.label,
            unitPrice: item.unitPrice,
            unitType: item.unitType,
            icon: item.icon || ''
          },
          create: {
            partnerId,
            category: item.category,
            label: item.label,
            unitPrice: item.unitPrice,
            unitType: item.unitType,
            icon: item.icon || ''
          }
        })
      )
    );

    // 저장 후 최신 단가표 반환
    const priceItems = await prisma.partnerPriceItem.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ message: '단가표가 저장되었습니다.', priceItems });
  } catch (error) {
    console.error('단가표 저장 오류:', error);
    res.status(500).json({ error: '단가표 저장 중 오류가 발생했습니다.' });
  }
});

// 전역 공지사항 설정 가져오기
router.get('/global-settings', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  try {
    let settings = await prisma.globalSettings.findUnique({ where: { id: 'global' } });
    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: { id: 'global', globalNotice: '', noticeIsActive: false, globalNoticeDetail: '' }
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('전역 설정 가져오기 오류:', error);
    res.status(500).json({ message: '전역 설정 로드 중 오류가 발생했습니다.' });
  }
});

// 전역 공지사항 설정 업데이트
router.patch('/global-settings', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const { globalNotice, noticeIsActive, globalNoticeDetail } = req.body;
  
  try {
    const updatedSettings = await prisma.globalSettings.upsert({
      where: { id: 'global' },
      update: { 
        globalNotice: globalNotice !== undefined ? String(globalNotice) : undefined,
        noticeIsActive: noticeIsActive !== undefined ? Boolean(noticeIsActive) : undefined,
        globalNoticeDetail: globalNoticeDetail !== undefined ? String(globalNoticeDetail) : undefined
      },
      create: {
        id: 'global',
        globalNotice: globalNotice !== undefined ? String(globalNotice) : '',
        noticeIsActive: noticeIsActive !== undefined ? Boolean(noticeIsActive) : false,
        globalNoticeDetail: globalNoticeDetail !== undefined ? String(globalNoticeDetail) : ''
      }
    });
    
    res.json({ message: '공지사항이 저장되었습니다.', settings: updatedSettings });
  } catch (error) {
    console.error('전역 설정 저장 오류:', error);
    res.status(500).json({ message: '공지사항 저장 중 오류가 발생했습니다.' });
  }
});

// 비회원 수동 접수(전화 접수) API
router.post('/requests/manual', authenticate, requireRole(['PARTNER', 'SUPER_ADMIN']), async (req: any, res: any) => {
  const requestData = req.body;
  const partnerId = req.user!.userId;

  try {
    let province = '';
    let city = '';
    const addressParts = (requestData.address || '').split(' ');
    province = addressParts[0] || ''; 
    if (province === '경기') province = '경기도'; 
    city = addressParts[1] || '';     

    let regionId = null;
    if (province && city) {
      const region = await prisma.region.findFirst({
        where: { province, city }
      });
      if (region) {
        regionId = region.id;
      }
    }

    const newRequest = await prisma.request.create({
      data: {
        userName: requestData.userName || '수동접수',
        phone: requestData.phone || '010-0000-0000',
        address: requestData.address,
        detailAddress: requestData.detailAddress || '',
        zipCode: requestData.zipCode || '00000',
        sigungu: city,
        bname: addressParts[2] || null,
        desiredDate: requestData.desiredDate ? new Date(requestData.desiredDate) : new Date(),
        estimatedVolume: requestData.estimatedVolume || '수동 접수 (상세불명)',
        status: 'ASSIGNED', // 사장님이 직접 등록하므로 바로 수락 및 배정 탭으로 이동
        partnerId,
        regionId,
        customerId: null, // 비회원
      }
    });

    // 구글 시트 연동
    addRequestToSheet({
      id: newRequest.id,
      userName: newRequest.userName,
      phone: newRequest.phone,
      address: newRequest.address,
      detailAddress: newRequest.detailAddress,
      desiredDate: newRequest.desiredDate.toISOString(),
      estimatedVolume: newRequest.estimatedVolume,
      status: newRequest.status,
    }).catch(err => console.error('구글 시트 연동 실패 (비동기):', err));

    res.status(201).json({ message: '수동 접수가 완료되었습니다.', request: newRequest });
  } catch (error) {
    console.error('수동 접수 에러:', error);
    res.status(500).json({ error: '수동 접수 중 오류가 발생했습니다.' });
  }
});

export default router;

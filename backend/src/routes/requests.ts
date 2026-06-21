import express from 'express';
import { addRequestToSheet } from '../services/googleSheets';
import { getCoordinates, getOptimalRoute } from '../services/kakaoRoute';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateMiddleware';
import { getStatusForAction } from '../services/statusService';

const router = express.Router();

// 새로운 수거 신청 생성 (입력값 검증 포함)
router.post('/', validateRequest, optionalAuthenticate, async (req: AuthRequest, res) => {
  const requestData = req.body;

  try {
    // 1. 주소 기반 파트너 자동 배정 (디테일한 권역 지도 매칭)
    let province = '';
    let city = '';
    let town = '';
    
    if (requestData.regionInfo && requestData.regionInfo.province) {
      province = requestData.regionInfo.province;
      city = requestData.regionInfo.city;
      town = requestData.regionInfo.town;
    } else {
      const addressParts = (requestData.address || '').split(' ');
      province = addressParts[0] || ''; 
      if (province === '경기') province = '경기도'; // DB 포맷 일치
      city = addressParts[1] || '';     
      town = addressParts[2] || '';
    }

    // 1순위: 읍/면/동(town) 단위 정확한 권역 매칭
    let region = await prisma.region.findFirst({
      where: { province, city, town },
      include: { coverages: true }
    });

    // 2순위: 시/군/구 전역(town: null) 권역 매칭
    if ((!region || region.coverages.length === 0) && city) {
      region = await prisma.region.findFirst({
        where: { province, city, town: null },
        include: { coverages: true }
      });
    }

    // 3순위: 같은 시/군/구에 등록된 아무 권역이라도 있으면 배정
    // (예: DB에 '평택시 비전동'만 있고, 신청 주소가 '평택시 신장동'인 경우)
    if ((!region || region.coverages.length === 0) && city) {
      region = await prisma.region.findFirst({
        where: { province, city },
        include: { coverages: true }
      });
    }

    let assignedPartnerId = null;
    let assignedRegionId = null;

    if (region && region.coverages.length > 0) {
      if (region.coverages.length === 1) {
        // 파트너가 1명이면 바로 배정
        assignedPartnerId = region.coverages[0].partnerId;
      } else {
        // 파트너가 여러 명이면 현재 진행 중인 건수가 가장 적은 파트너에게 배정 (로드밸런싱)
        const partnerIds = region.coverages.map((c: any) => c.partnerId);
        const activeCounts = await Promise.all(
          partnerIds.map(async (pid: string) => {
            const count = await prisma.request.count({
              where: { partnerId: pid, status: { notIn: ['COMPLETED'] } }
            });
            return { partnerId: pid, activeCount: count };
          })
        );
        // 진행 중인 건수가 가장 적은 파트너 선택
        activeCounts.sort((a, b) => a.activeCount - b.activeCount);
        assignedPartnerId = activeCounts[0].partnerId;
      }
      assignedRegionId = region.id;
    }

    // 2. DB에 수거 신청 데이터 저장
    const newRequest = await prisma.request.create({
      data: {
        userName: requestData.userName || '비회원',
        phone: requestData.phone || '010-0000-0000',
        address: requestData.address,
        detailAddress: requestData.detailAddress,
        zipCode: requestData.zipCode,
        desiredDate: new Date(requestData.desiredDate),
        estimatedVolume: requestData.estimatedVolume,
        status: getStatusForAction.onRequestCreated(!!assignedPartnerId),
        partnerId: assignedPartnerId,
        regionId: assignedRegionId,
        customerId: req.user?.userId || null,
      }
    });

    // 3. 구글 스프레드시트에 연동 (이중 백업, 비동기 처리 - 응답 지연 방지)
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

    res.status(201).json({ 
      message: '수거 신청이 완료되었습니다.',
      assignedPartner: assignedPartnerId ? '해당 지역 사장님께 배정되었습니다.' : '배정 대기중입니다.',
      request: newRequest
    });
  } catch (error) {
    console.error('수거 신청 접수 오류:', error);
    res.status(500).json({ error: '수거 신청을 처리하는 중 문제가 발생했습니다.' });
  }
});

// 로그인한 고객의 신청 내역 조회
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const requests = await prisma.request.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { include: { user: true } },
        partner: { select: { businessName: true, name: true, phone: true } }
      }
    });
    res.json({ requests });
  } catch (error) {
    console.error('고객 신청 내역 조회 오류:', error);
    res.status(500).json({ error: '신청 내역을 불러오는데 실패했습니다.' });
  }
});


// 관리자용 - 모든 신청 내역 조회 (인증 필수)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const requests = await prisma.request.findMany({ 
      orderBy: { createdAt: 'desc' } 
    });
    
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: '목록 조회 실패' });
  }
});

// 관리자용 - 기사 배정 API (드래그 앤 드롭 연동용, 인증 필수)
router.patch('/:id/assign', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const driverId = typeof req.body.driverId === 'string' ? req.body.driverId : undefined;

  try {
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        driverId: driverId || null ,
        status: driverId ? 'ASSIGNED' : 'PENDING'
      }
    });
    res.json({ message: '배정 상태가 업데이트 되었습니다.', request: updatedRequest });
  } catch (error) {
    console.error('배정 업데이트 오류:', error);
    res.status(500).json({ error: '배정 상태 업데이트에 실패했습니다.' });
  }
});

// 동선 최적화 API
router.post('/optimize', async (req, res) => {
  try {
    const { originAddress, requestAddresses } = req.body;
    
    // 출발지 좌표 변환
    const originCoords = await getCoordinates(originAddress);
    if (!originCoords) return res.status(400).json({ error: '출발지 주소를 찾을 수 없습니다.' });

    // 목적지 좌표 변환
    const destinationCoords = [];
    for (const reqAddr of requestAddresses) {
      const coords = await getCoordinates(reqAddr.address);
      if (coords) {
        destinationCoords.push({ name: reqAddr.id, x: coords.x, y: coords.y });
      }
    }

    if (destinationCoords.length === 0) {
      return res.status(400).json({ error: '유효한 수거지 주소가 없습니다.' });
    }

    // 최적 경로 계산
    const routeResult = await getOptimalRoute(originCoords, destinationCoords);
    res.json(routeResult);
  } catch (error) {
    console.error('동선 최적화 API 에러:', error);
    res.status(500).json({ error: '최적 동선 계산에 실패했습니다.' });
  }
});

export default router;

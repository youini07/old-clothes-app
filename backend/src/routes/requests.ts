import express from 'express';
import { addRequestToSheet } from '../services/googleSheets';
import { getCoordinates, getOptimalRoute } from '../services/kakaoRoute';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateMiddleware';
import { getStatusForAction } from '../services/statusService';
import { sendNewRequestToPartner } from '../services/notificationService';

const router = express.Router();

// 새로운 수거 신청 생성 (입력값 검증 포함)
router.post('/', validateRequest, optionalAuthenticate, async (req: AuthRequest, res) => {
  const requestData = req.body;

  try {
    // 1. 주소에서 시/도, 시/군/구 파싱 (통계용 regionId 기록)
    let province = '';
    let city = '';
    
    if (requestData.regionInfo && requestData.regionInfo.province) {
      province = requestData.regionInfo.province;
      city = requestData.regionInfo.city;
    } else {
      const addressParts = (requestData.address || '').split(' ');
      province = addressParts[0] || ''; 
      if (province === '경기') province = '경기도'; // DB 포맷 일치
      city = addressParts[1] || '';     
    }

    // 통계용 regionId 조회 및 해당 권역 사장님 찾기
    let regionId = null;
    let partnerToNotify = null;
    if (province && city) {
      const region = await prisma.region.findFirst({
        where: { province, city },
        include: { coverages: { include: { partner: true } } }
      });
      if (region) {
        regionId = region.id;
        if (region.coverages.length > 0) {
          partnerToNotify = region.coverages[0].partner;
        }
      }
    }

    // 2. DB에 수거 신청 데이터 저장
    // 파트너 자동 배정하지 않음 — 사장님이 직접 수락하는 선착순 방식
    const newRequest = await prisma.request.create({
      data: {
        userName: requestData.userName || '비회원',
        phone: requestData.phone || '010-0000-0000',
        address: requestData.address,
        detailAddress: requestData.detailAddress,
        zipCode: requestData.zipCode,
        sigungu: requestData.regionInfo?.city || null,
        bname: requestData.regionInfo?.town || null,
        desiredDate: new Date(requestData.desiredDate),
        isMustPickupDate: !!requestData.isMustPickupDate,
        estimatedVolume: requestData.estimatedVolume,
        status: 'PENDING', // 항상 미배정(PENDING)으로 시작
        partnerId: null,   // 사장님이 수락할 때까지 null
        regionId,
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

    // 4. 파트너 사장님께 신규 신청 알림톡 발송 (비동기 처리)
    if (partnerToNotify && partnerToNotify.phone) {
      sendNewRequestToPartner(
        partnerToNotify.phone,
        newRequest.userName,
        newRequest.address,
        partnerToNotify.useBizMessage
      ).catch(err => console.error('신규 신청 알림톡 전송 실패:', err));
    }

    res.status(201).json({ 
      message: '수거 신청이 완료되었습니다.',
      assignedPartner: '주변 업체 사장님들에게 알림을 보냈습니다. 곧 수락될 예정입니다.',
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const whereCondition = { customerId: userId };
    const totalCount = await prisma.request.count({ where: whereCondition });
    const requests = await prisma.request.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        driver: { include: { user: true } },
        partner: { select: { businessName: true, name: true, phone: true } }
      }
    });
    const totalPages = Math.ceil(totalCount / limit);
    res.json({ requests, totalPages, currentPage: page, totalCount });
  } catch (error) {
    console.error('고객 신청 내역 조회 오류:', error);
    res.status(500).json({ error: '신청 내역을 불러오는데 실패했습니다.' });
  }
});


// 관리자용 - 모든 신청 내역 조회 (인증 필수)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const totalCount = await prisma.request.count();
    const requests = await prisma.request.findMany({ 
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });
    
    const totalPages = Math.ceil(totalCount / limit);
    res.json({ requests, totalPages, currentPage: page, totalCount });
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

// 고객 포장 사진 업로드 API
router.patch('/:id/customer-photo', optionalAuthenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { customerPackedPhotoUrl } = req.body;

    const existingRequest = await prisma.request.findUnique({ where: { id } });
    if (!existingRequest) {
      return res.status(404).json({ error: '수거 신청건을 찾을 수 없습니다.' });
    }

    // 보안 검사 (선택 사항): 로그인한 유저라면 자신의 요청인지 확인 (비회원 신청건은 통과)
    if (req.user && existingRequest.customerId && req.user.userId !== existingRequest.customerId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { customerPackedPhotoUrl }
    });

    res.json({ message: '포장 사진이 성공적으로 업로드되었습니다.', request: updatedRequest });
  } catch (error) {
    console.error('포장 사진 업로드 에러:', error);
    res.status(500).json({ error: '사진 업로드 중 문제가 발생했습니다.' });
  }
});

// 고객 수거 취소 API (예약접수 상태에서만 가능)
router.patch('/:id/cancel', optionalAuthenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    
    const existingRequest = await prisma.request.findUnique({ where: { id } });
    if (!existingRequest) {
      return res.status(404).json({ error: '수거 신청건을 찾을 수 없습니다.' });
    }

    // 본인 확인 (로그인 유저인 경우)
    if (req.user && existingRequest.customerId && req.user.userId !== existingRequest.customerId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    if (existingRequest.status !== 'PENDING') {
      return res.status(400).json({ error: '예약접수 상태인 경우에만 취소가 가능합니다. 이미 접수/배차가 진행된 경우 고객센터(카카오채널)로 문의해 주세요.' });
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({ message: '수거 신청이 취소되었습니다.', request: updatedRequest });
  } catch (error) {
    console.error('수거 취소 에러:', error);
    res.status(500).json({ error: '수거 취소 중 문제가 발생했습니다.' });
  }
});

export default router;

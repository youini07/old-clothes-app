import express from 'express';
import { addRequestToSheet } from '../services/googleSheets';
import { getCoordinates, getOptimalRoute } from '../services/kakaoRoute';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// 새로운 수거 신청 생성
router.post('/', async (req, res) => {
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
      city = addressParts[1] || '';     
      town = addressParts[2] || '';
    }

    // 1순위: 읍/면/동(town) 단위 디테일 권역 매칭
    let region = await prisma.region.findFirst({
      where: { province, city, town },
      include: { coverages: true }
    });

    // 2순위: 읍/면/동 매칭 실패 시 시/군/구 전역(town: null) 권역 매칭
    if ((!region || region.coverages.length === 0) && city) {
      region = await prisma.region.findFirst({
        where: { province, city, town: null },
        include: { coverages: true }
      });
    }

    let assignedPartnerId = null;
    let assignedRegionId = null;

    if (region && region.coverages.length > 0) {
      // 해당 지역을 담당하는 첫 번째 파트너에게 배정 (나중에는 로드밸런싱 가능)
      assignedPartnerId = region.coverages[0].partnerId;
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
        status: assignedPartnerId ? 'ASSIGNED' : 'PENDING',
        partnerId: assignedPartnerId,
        regionId: assignedRegionId,
      }
    });

    // 3. 구글 스프레드시트에 연동 (이중 백업)
    await addRequestToSheet({
      id: newRequest.id,
      userName: newRequest.userName,
      phone: newRequest.phone,
      address: newRequest.address,
      detailAddress: newRequest.detailAddress,
      desiredDate: newRequest.desiredDate.toISOString(),
      estimatedVolume: newRequest.estimatedVolume,
      status: newRequest.status,
    });

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


// 관리자용 - 모든 신청 내역 조회
router.get('/', async (req, res) => {
  try {
    const requests = await prisma.request.findMany({ 
      orderBy: { createdAt: 'desc' } 
    });
    
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: '목록 조회 실패' });
  }
});

// 관리자용 - 기사 배정 API (드래그 앤 드롭 연동용)
router.patch('/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body;

  try {
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        driverId: driverId,
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

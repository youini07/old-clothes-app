import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { getSingleRouteETA } from '../services/kakaoRoute';
import { sendDepartureNotification, sendCompletionToCustomer } from '../services/notificationService';
import { updateRequestStatusInSheet } from '../services/googleSheets';
import { getStatusForAction } from '../services/statusService';

const router = express.Router();

// ==========================================
// [DRIVER 전용] 수거 기사 앱 기능
// ==========================================

// 1. 배정된 오늘의 수거 동선 목록 조회
router.get('/requests', authenticate, requireRole(['DRIVER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    // 기사 프로필 찾기
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId }
    });

    if (!driverProfile) {
      return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    }

    const requests = await prisma.request.findMany({
      where: { driverId: driverProfile.id },
      orderBy: { orderIndex: 'asc' } // 동선 순서대로 정렬
    });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: '수거 일정 조회 실패' });
  }
});

// 2. 동선 순서 수동 변경 (Drag & Drop 결과)
router.put('/reorder', authenticate, requireRole(['DRIVER']), async (req: any, res: any) => {
  const { reorderedRequests } = req.body; 
  // reorderedRequests: [{ id: 'req_1', orderIndex: 0 }, { id: 'req_2', orderIndex: 1 }, ...]
  
  try {
    // 트랜잭션으로 일괄 업데이트
    await prisma.$transaction(
      reorderedRequests.map((reqItem: { id: string, orderIndex: number }) => 
        prisma.request.update({
          where: { id: reqItem.id },
          data: { orderIndex: reqItem.orderIndex }
        })
      )
    );
    res.json({ message: '동선 순서가 업데이트 되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '동선 순서 변경 실패' });
  }
});

// 3. 수거 완료 처리 (다단계 사진 및 무게 입력)
// 향후 multer & aws-sdk 를 이용한 R2 업로드 연동 필요
router.post('/complete/:id', authenticate, requireRole(['DRIVER']), async (req: any, res: any) => {
  const { id } = req.params;
  const { actualWeight, driverNote, itemPhotoUrl, scalePhotoUrl, extraPhotoUrl } = req.body as any;

  try {
    // 1. 기존 수거 요청 및 배정된 파트너(사장님) 정보 조회
    const existingRequest = await prisma.request.findUnique({
      where: { id },
      include: { partner: true }
    });
    
    if (!existingRequest) {
      return res.status(404).json({ error: '수거 요청을 찾을 수 없습니다.' });
    }

    // 2. 단가(pricePerKg) 적용: 파트너 설정값이 없으면 기본값 300원 사용
    const PRICE_PER_KG = existingRequest.partner?.pricePerKg ?? 300;
    const weight = parseFloat(actualWeight);
    const totalPrice = weight * PRICE_PER_KG;

    // 3. 수거 완료 처리 및 무게/금액 업데이트
    const request = await prisma.request.update({
      where: { id },
      data: {
        actualWeight: weight,
        totalPrice,
        driverNote,
        itemPhotoUrl,
        scalePhotoUrl,
        extraPhotoUrl,
        status: getStatusForAction.onCompleted(),
        completedDate: new Date()
      },
      include: { partner: true }
    });
    
    // 수거 완료 및 정산 알림톡 발송 (비동기)
    if (request.partner && request.partner.useBizMessage) {
      sendCompletionToCustomer(
        request.phone,
        request.userName,
        weight,
        totalPrice,
        request.partner.useBizMessage
      ).catch(err => console.error('완료 안내 알림톡 전송 실패:', err));
    }
    
    // 구글 시트에 완료 상태 및 무게/메모 업데이트
    await updateRequestStatusInSheet(id as string, 'COMPLETED', parseFloat(actualWeight), driverNote as string);
    
    res.json({ message: '수거가 완료되었습니다!', request });
  } catch (error) {
    res.status(500).json({ error: '수거 완료 처리 실패' });
  }
});

// 4. 수거 출발 처리 및 ETA 계산
router.post('/depart/:id', authenticate, requireRole(['DRIVER']), async (req: any, res: any) => {
  const { id } = req.params;
  const { currentLat, currentLng } = req.body as any;

  try {
    // 1. 요청 정보 가져오기
    const request = await prisma.request.findUnique({ where: { id: id as string } });
    if (!request) {
      return res.status(404).json({ error: '수거 신청 건을 찾을 수 없습니다.' });
    }

    let etaMinutes = null;

    // 2. 카카오 API로 ETA 계산 (현재 위치가 제공된 경우)
    if (currentLat && currentLng && request.address) {
      try {
        etaMinutes = await getSingleRouteETA(currentLng.toString(), currentLat.toString(), request.address);
      } catch (etaError) {
        console.error('ETA 계산 실패 (API키 미설정 등), 출발 처리는 계속 진행합니다.', etaError);
        // ETA 계산에 실패해도 출발 처리는 진행해야 하므로 에러를 무시합니다.
      }
    }

    // 3. 상태 업데이트
    const updatedRequest = await prisma.request.update({
      where: { id: id as string },
      data: {
        status: getStatusForAction.onDriverDeparted(),
        etaMinutes
      }
    });

    // 5. 파트너(사장님)의 비즈메시지 설정 확인
    let useBizMessage = false;
    if (request.partnerId) {
      const partner = await prisma.user.findUnique({ where: { id: request.partnerId } });
      if (partner) {
        useBizMessage = partner.useBizMessage;
      }
    }

    // 6. 기사 전화번호 조회
    let driverPhone = undefined;
    const driver = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (driver && driver.phone) {
      driverPhone = driver.phone;
    }

    // 7. 고객에게 알림톡/문자 발송
    await sendDepartureNotification(request.phone, request.userName, etaMinutes, useBizMessage, driverPhone);

    res.json({ message: '출발 처리가 완료되었습니다.', request: updatedRequest });
  } catch (error) {
    console.error('출발 처리 에러:', error);
    res.status(500).json({ error: '출발 처리 중 문제가 발생했습니다.' });
  }
});

import fs from 'fs';
import path from 'path';

// 5. 기사 본인 정보(프로필) 조회
router.get('/me', authenticate, requireRole(['DRIVER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true }
    });
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    
    res.json({
      name: user.name,
      phone: user.phone || '',
      email: user.email || '',
      vehicleInfo: user.driverProfile?.vehicleInfo || ''
    });
  } catch (error: any) {
    const errStr = error.message || String(error);
    fs.writeFileSync(path.join(__dirname, '../../error_log_get.txt'), errStr);
    console.error('프로필 조회 에러 상세내역:', errStr);
    res.status(500).json({ error: '프로필 조회 실패', details: errStr });
  }
});

// 6. 기사 프로필 수정
router.patch('/me', authenticate, requireRole(['DRIVER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const { name, phone, vehicleInfo } = req.body;
    
    await prisma.user.update({
      where: { id: userId },
      data: { name, phone }
    });
    
    // driverProfile이 없을 수도 있는 예외 상황을 방지하기 위해 updateMany 사용
    await prisma.driverProfile.updateMany({
      where: { userId },
      data: { vehicleInfo }
    });
    
    res.json({ message: '프로필이 업데이트되었습니다.' });
  } catch (error: any) {
    const errStr = error.message || String(error);
    fs.writeFileSync(path.join(__dirname, '../../error_log_patch.txt'), errStr);
    console.error('프로필 수정 에러 상세내역:', errStr);
    res.status(500).json({ error: '프로필 수정 실패', details: errStr });
  }
});

export default router;

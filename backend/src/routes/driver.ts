import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { getSingleRouteETA, getCoordinates } from '../services/kakaoRoute';
import axios from 'axios';
import { sendDepartureNotification, sendCompletionToCustomer } from '../services/notificationService';
import { updateRequestStatusInSheet } from '../services/googleSheets';
import { getStatusForAction } from '../services/statusService';

// ==========================================
// 항목별 수거 단가표 (카테고리별 단가 정의)
// 왜 코드에 정의하는가: 현재 모든 파트너가 동일 단가를 사용.
// 향후 파트너별 커스텀 단가가 필요하면 DB 테이블로 분리 예정.
// ==========================================
export const PRICE_TABLE = [
  { category: 'CLOTHES',   label: '헌옷 (신발, 가방 포함)', unitPrice: 400,   unitType: 'KG'   as const, icon: '👕' },
  { category: 'BOOKS',     label: '헌책',                   unitPrice: 30,    unitType: 'KG'   as const, icon: '📚' },
  { category: 'COOKWARE',  label: '후라이팬, 냄비류',        unitPrice: 300,   unitType: 'KG'   as const, icon: '🍳' },
  { category: 'PHONE',     label: '핸드폰',                 unitPrice: 500,   unitType: 'UNIT' as const, icon: '📱' },
  { category: 'COMPUTER',  label: '컴퓨터, 노트북',         unitPrice: 2000,  unitType: 'UNIT' as const, icon: '💻' },
  { category: 'CD_TAPE',   label: '음악 CD/음악 테이프',     unitPrice: 500,   unitType: 'KG'   as const, icon: '💿' },
  { category: 'LP',        label: '음악 LP판',              unitPrice: 1000,  unitType: 'KG'   as const, icon: '🎵' },
  { category: 'AC_STAND',  label: '스탠드 에어컨 (실외기 포함)', unitPrice: 20000, unitType: 'UNIT' as const, icon: '❄️' },
  { category: 'AC_WALL',   label: '벽걸이 에어컨 (실외기 포함)', unitPrice: 10000, unitType: 'UNIT' as const, icon: '🌀' },
];

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

const router = express.Router();


// ==========================================
// [DRIVER 전용] 수거 기사 앱 기능
// ==========================================

// 1. 배정된 오늘의 수거 동선 목록 조회
router.get('/requests', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50; // 기사는 동선 정렬을 위해 기본 50건
    const skip = (page - 1) * limit;

    // 기사 프로필 찾기
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId }
    });

    if (!driverProfile) {
      return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    }

    const whereCondition = { driverId: driverProfile.id };
    const totalCount = await prisma.request.count({ where: whereCondition });
    const requests = await prisma.request.findMany({
      where: whereCondition,
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'asc' }
      ], // 동선 순서, 그 다음 생성일 순으로 정렬하여 순서 고정
      skip,
      take: limit,
      include: {
        collectionItems: true // 항목별 수거 정산 내역을 함께 조회
      }
    });

    const totalPages = Math.ceil(totalCount / limit);
    res.json({ requests, totalPages, currentPage: page, totalCount });
  } catch (error) {
    res.status(500).json({ error: '수거 일정 조회 실패' });
  }
});

// 2. 동선 순서 수동 변경 (Drag & Drop 결과)
router.put('/reorder', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
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
router.post('/complete/:id', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  const { id } = req.params;
  // 변경: 기존의 단일 무게 입력 대신 항목별 배열을 수신
  const { items, driverNote } = req.body as {
    items: Array<{
      category: string;
      categoryLabel: string;
      quantity: number;
      unitType: string;
      unitPrice: number;
      subtotal: number;
      photoUrl?: string;
    }>;
    driverNote?: string;
  };

  try {
    // 1. 기존 수거 요청 및 배정된 파트너(사장님) 정보 조회
    const existingRequest = await prisma.request.findUnique({
      where: { id },
      include: { partner: true }
    });
    
    if (!existingRequest) {
      return res.status(404).json({ error: '수거 요청을 찾을 수 없습니다.' });
    }

    // 2. 항목이 없으면 에러 반환
    if (!items || items.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 수거 항목을 입력해주세요.' });
    }

    // 3. 항목별 합산 계산
    // - actualWeight: kg 단위 항목들의 무게 합산 (호환용)
    // - totalPrice: 모든 항목의 subtotal 합산
    const totalWeight = items
      .filter(item => item.unitType === 'KG')
      .reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);

    // 4. 트랜잭션으로 수거 완료 처리 + 항목 일괄 생성
    const request = await prisma.$transaction(async (tx) => {
      // 4-1. Request 상태 업데이트
      const updatedRequest = await tx.request.update({
        where: { id },
        data: {
          actualWeight: totalWeight || null,
          totalPrice,
          driverNote: driverNote || '수거 완료',
          itemPhotoUrl: items[0]?.photoUrl || null, // 기존 호환: 첫 번째 항목 사진
          status: getStatusForAction.onCompleted(),
          completedDate: new Date()
        },
        include: { partner: true }
      });

      // 4-2. CollectionItem 일괄 생성
      await tx.collectionItem.createMany({
        data: items.map(item => ({
          requestId: id,
          category: item.category,
          categoryLabel: item.categoryLabel,
          quantity: item.quantity,
          unitType: item.unitType,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          photoUrl: item.photoUrl || null
        }))
      });

      return updatedRequest;
    });
    
    // 5. 수거 완료 및 정산 알림톡 발송 (영수증 형태)
    if (request.partner && request.partner.useBizMessage) {
      sendCompletionToCustomer(
        request.phone,
        request.userName,
        items, // 변경: 항목 배열을 전달하여 영수증 형태 메시지 생성
        totalPrice,
        request.partner.useBizMessage
      ).catch(err => console.error('완료 안내 알림톡 전송 실패:', err));
    }
    
    // 6. 구글 시트에 완료 상태 및 무게/메모 업데이트
    await updateRequestStatusInSheet(id as string, 'COMPLETED', totalWeight, driverNote as string);
    
    res.json({ message: '수거가 완료되었습니다!', request });
  } catch (error) {
    console.error('수거 완료 처리 에러:', error);
    res.status(500).json({ error: '수거 완료 처리 실패' });
  }
});

// 4. 수거 출발 처리 및 ETA 계산
router.post('/depart/:id', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
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
router.get('/me', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        driverProfile: {
          include: { partner: true }
        } 
      }
    });
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    
    res.json({
      name: user.name,
      phone: user.phone || '',
      email: user.email || '',
      vehicleInfo: user.driverProfile?.vehicleInfo || '',
      partnerAddress: user.driverProfile?.partner?.address || '',
      partnerBusinessName: user.driverProfile?.partner?.businessName || user.driverProfile?.partner?.name || ''
    });
  } catch (error: any) {
    const errStr = error.message || String(error);
    fs.writeFileSync(path.join(__dirname, '../../error_log_get.txt'), errStr);
    console.error('프로필 조회 에러 상세내역:', errStr);
    res.status(500).json({ error: '프로필 조회 실패', details: errStr });
  }
});

// 6. 기사 프로필 수정
router.patch('/me', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
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

// 7. 기사별 동선 최적화 (카카오/T맵 좌표 API 기반 현위치 출발 정렬)
router.post('/optimize-route', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  const userId = req.user!.userId;
  const { currentLat, currentLng, returnToStart, returnAddress } = req.body;

  try {
    // 기사 프로필 확인
    const driver = await prisma.driverProfile.findUnique({
      where: { userId }
    });
    if (!driver) {
      return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    }

    if (!currentLat || !currentLng) {
      return res.status(400).json({ error: '현재 위치 좌표가 필요합니다.' });
    }

    // 기사에게 배정된 미완료 수거 건 조회
    const requests = await prisma.request.findMany({
      where: { driverId: driver.id, status: { not: 'COMPLETED' } }
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
      } else {
        // 좌표 변환 실패 시 기사 현위치로 임시 매핑
        destinations.push({
          request: r,
          x: parseFloat(currentLng),
          y: parseFloat(currentLat)
        });
      }
    }

    // T맵 API 키 확인
    const tmapAppKey = process.env.TMAP_APP_KEY;
    let optimizedList: any[] = [];

    let totalTimeSec = 0;
    let totalDistanceMeter = 0;
    let usedTmap = false;

    if (tmapAppKey && tmapAppKey.length > 0) {
      try {
        // 1. 목적지들을 최대 20개 단위의 지리적 클러스터로 분할
        const clusters = createClusters(destinations, parseFloat(currentLng), parseFloat(currentLat), 20);
        let currentStartX = parseFloat(currentLng);
        let currentStartY = parseFloat(currentLat);

        for (const cluster of clusters) {
          if (cluster.length === 0) continue;

          // 2. T맵 다중 경유지 최적화 API 연동 (routeOptimization20)
          // 마지막 요소를 목적지로 임시 설정
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
            searchOption: "0", // 0: 추천 (가장 빠른 길)
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
            {
              headers: {
                appKey: tmapAppKey,
                'Content-Type': 'application/json'
              }
            }
          );

          if (tmapRes.data && tmapRes.data.properties && tmapRes.data.features) {
            totalTimeSec += tmapRes.data.properties.totalTime || 0;
            totalDistanceMeter += tmapRes.data.properties.totalDistance || 0;
            usedTmap = true;

            // features 안에서 경유지 순서를 파악
            const features = tmapRes.data.features;
            const orderedVias = features.filter((f: any) => f.properties && f.properties.viaPointId);
            
            // 정렬된 순서대로 optimizedList에 추가
            for (const via of orderedVias) {
              const dest = cluster.find((d: any) => d.request.id === via.properties.viaPointId);
              if (dest && !optimizedList.find(r => r.id === dest.request.id)) {
                optimizedList.push(dest.request);
              }
            }
            
            // TMAP 결과 누락(도착지 등) 처리
            for (const dest of cluster) {
              if (!optimizedList.find(r => r.id === dest.request.id)) {
                optimizedList.push(dest.request);
              }
            }

            // 다음 클러스터 출발지는 현재 클러스터의 마지막 수거지
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
        console.error('T맵 API 호출 실패, 유클리드 거리로 폴백:', tmapError.response?.data || tmapError.message);
        optimizedList = [];
        usedTmap = false;
        totalTimeSec = 0;
        totalDistanceMeter = 0;
      }
    }

    // T맵 API가 없거나 실패한 경우, 또는 경유지가 20개를 초과하는 경우: Nearest Neighbor + 2-Opt 폴백
    if (optimizedList.length === 0) {
      const startX = parseFloat(currentLng);
      const startY = parseFloat(currentLat);
      
      let endX = startX;
      let endY = startY;

      // 마지막 복귀 주소가 명시적으로 있는 경우 좌표 변환
      if (returnToStart && returnAddress && returnAddress.trim() !== '') {
        const coords = await getCoordinates(returnAddress);
        if (coords) {
          endX = parseFloat(coords.x);
          endY = parseFloat(coords.y);
        }
      }

      const unvisited = [...destinations];
      let route: any[] = [];
      let cx = startX;
      let cy = startY;

      // 1. Initial Route with Nearest Neighbor
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

      // 2. 2-Opt Algorithm to resolve crossings and optimize (True TSP)
      let improved = true;
      let iterations = 0;
      while (improved && iterations < 1000) { // Safety limit
        improved = false;
        iterations++;
        for (let i = 0; i < route.length - 1; i++) {
          for (let k = i + 1; k < route.length; k++) {
            const node_i_minus_1 = i === 0 ? { x: startX, y: startY } : route[i - 1];
            const node_i = route[i];
            const node_k = route[k];
            const node_k_plus_1 = k === route.length - 1 
              ? (returnToStart ? { x: endX, y: endY } : null) 
              : route[k + 1];

            const d1 = Math.sqrt(Math.pow(node_i_minus_1.x - node_i.x, 2) + Math.pow(node_i_minus_1.y - node_i.y, 2));
            const d2 = node_k_plus_1 ? Math.sqrt(Math.pow(node_k.x - node_k_plus_1.x, 2) + Math.pow(node_k.y - node_k_plus_1.y, 2)) : 0;
            
            const new_d1 = Math.sqrt(Math.pow(node_i_minus_1.x - node_k.x, 2) + Math.pow(node_i_minus_1.y - node_k.y, 2));
            const new_d2 = node_k_plus_1 ? Math.sqrt(Math.pow(node_i.x - node_k_plus_1.x, 2) + Math.pow(node_i.y - node_k_plus_1.y, 2)) : 0;

            if (new_d1 + new_d2 < d1 + d2 - 0.0000001) { // EPSILON to prevent infinite loops on float math
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

    // 총 주행거리 계산 (km로 변환하여 저장)
    const todayDistanceKm = usedTmap ? parseFloat((totalDistanceMeter / 1000).toFixed(1)) : null;
    
    if (todayDistanceKm !== null) {
      await prisma.driverProfile.update({
        where: { id: driver.id },
        data: { todayDistanceKm }
      });
    }

    res.json({
      message: '현위치 기반 동선 최적화가 완료되었습니다!',
      totalTimeSec,
      totalDistanceMeter,
      usedTmap,
      optimizedRequests: optimizedList.map((r, idx) => {
        const dest = destinations.find(d => d.request.id === r.id);
        return {
          id: r.id,
          userName: r.userName,
          address: r.address,
          orderIndex: idx,
          x: dest ? dest.x.toString() : currentLng,
          y: dest ? dest.y.toString() : currentLat
        };
      })
    });
  } catch (error) {
    console.error('현위치 기반 동선 최적화 에러:', error);
    res.status(500).json({ error: '동선 최적화 중 오류가 발생했습니다.' });
  }
});

// ==========================================
// 단가표 조회 API — 기사 앱에서 카테고리 목록 + 단가를 가져감
// 파트너(사장님)가 커스텀 단가를 설정했으면 해당 단가를, 아니면 기본 단가표를 반환
// ==========================================
router.get('/price-table', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    
    // 기사의 소속 파트너 ID 조회
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { partnerId: true }
    });
    
    const partnerId = driverProfile?.partnerId || userId; // 파트너 본인이면 자기 ID 사용
    
    // 파트너의 커스텀 단가표 조회
    const customPriceItems = await prisma.partnerPriceItem.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'asc' }
    });
    
    if (customPriceItems.length > 0) {
      // 커스텀 단가표가 있으면 해당 단가 사용
      const priceTable = customPriceItems.map(item => ({
        category: item.category,
        label: item.label,
        unitPrice: item.unitPrice,
        unitType: item.unitType,
        icon: item.icon || ''
      }));
      return res.json({ priceTable, isCustom: true });
    }
    
    // 커스텀 단가표가 없으면 기본 단가표 사용
    res.json({ priceTable: PRICE_TABLE, isCustom: false });
  } catch (error) {
    console.error('단가표 조회 에러:', error);
    res.status(500).json({ error: '단가표 조회 실패' });
  }
});


// ============================================
// 기사 본인 하루 정산 통계 조회
// ============================================
router.get('/daily-stats', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const dateQuery = req.query.date as string; // YYYY-MM-DD
    
    // 기사 프로필 찾기
    const driver = await prisma.driverProfile.findUnique({
      where: { userId }
    });
    
    if (!driver) {
      return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    }

    let dateFilter = {};
    if (dateQuery) {
      const startOfDay = new Date(dateQuery + 'T00:00:00.000Z');
      const endOfDay = new Date(dateQuery + 'T23:59:59.999Z');
      
      // 한국 시간 기준으로 보정 (옵션에 따라 다름)
      startOfDay.setHours(startOfDay.getHours() - 9);
      endOfDay.setHours(endOfDay.getHours() - 9);

      dateFilter = {
        completedDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      };
    } else {
      // 날짜가 없으면 오늘을 기준으로
      const now = new Date();
      now.setHours(now.getHours() + 9); // KST 변환
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      
      const startOfDay = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
      const endOfDay = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999Z`);
      
      startOfDay.setHours(startOfDay.getHours() - 9);
      endOfDay.setHours(endOfDay.getHours() - 9);

      dateFilter = {
        completedDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      };
    }

    // 통계 계산
    const completedRequests = await prisma.request.findMany({
      where: {
        driverId: driver.id,
        status: 'COMPLETED',
        ...dateFilter
      },
      select: {
        actualWeight: true,
        totalPrice: true
      }
    });

    const stats = {
      count: completedRequests.length,
      totalWeight: completedRequests.reduce((acc: number, req: any) => acc + (req.actualWeight || 0), 0),
      totalPrice: completedRequests.reduce((acc: number, req: any) => acc + (req.totalPrice || 0), 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('일일 정산 조회 실패:', error);
    res.status(500).json({ error: '일일 정산 내역을 가져오는데 실패했습니다.' });
  }
});

// ============================================
// 커스텀 문자 템플릿 저장 및 조회
// ============================================
router.get('/sms-template', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const driver = await prisma.driverProfile.findUnique({
      where: { userId }
    });
    
    if (!driver) return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    
    res.json({ smsTemplates: driver.smsTemplates || null });
  } catch (error) {
    res.status(500).json({ error: '템플릿 조회 실패' });
  }
});

router.put('/sms-template', authenticate, requireRole(['DRIVER', 'PARTNER']), async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    const { smsTemplates } = req.body;
    
    const driver = await prisma.driverProfile.findUnique({
      where: { userId }
    });
    
    if (!driver) return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
    
    await prisma.driverProfile.update({
      where: { id: driver.id },
      data: { smsTemplates }
    });
    
    res.json({ success: true, message: '저장되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '템플릿 저장 실패' });
  }
});

export default router;

import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { getSingleRouteETA, getCoordinates } from '../services/kakaoRoute';
import axios from 'axios';
import { sendDepartureNotification, sendCompletionToCustomer } from '../services/notificationService';
import { updateRequestStatusInSheet } from '../services/googleSheets';
import { getStatusForAction } from '../services/statusService';

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
  const { currentLat, currentLng } = req.body;

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

    // T맵 API가 없거나 실패한 경우, 또는 경유지가 20개를 초과하는 경우: Nearest Neighbor 폴백
    if (optimizedList.length === 0) {
      let currentX = parseFloat(currentLng);
      let currentY = parseFloat(currentLat);
      const unvisited = [...destinations];

      // 1. 시/구(도시) 단위로 먼저 그룹화하여 지그재그 이동 방지
      const grouped: Record<string, any[]> = {};
      for (const dest of unvisited) {
        // 주소나 sigungu에서 '수원시', '용인시' 등을 추출
        const city = dest.request.sigungu ? dest.request.sigungu.split(' ')[0] : '기타';
        if (!grouped[city]) grouped[city] = [];
        grouped[city].push(dest);
      }

      let groups = Object.values(grouped);

      // 2. 가장 가까운 그룹(도시) 단위로 순차 방문
      while (groups.length > 0) {
        let closestGroupIdx = 0;
        let minGroupDist = Infinity;
        
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          let minPtDist = Infinity;
          for (const pt of group) {
            const dist = Math.sqrt(Math.pow(pt.x - currentX, 2) + Math.pow(pt.y - currentY, 2));
            if (dist < minPtDist) {
              minPtDist = dist;
            }
          }
          if (minPtDist < minGroupDist) {
            minGroupDist = minPtDist;
            closestGroupIdx = i;
          }
        }

        const targetGroup = groups.splice(closestGroupIdx, 1)[0];
        
        // 3. 해당 그룹(도시) 내에서 Nearest Neighbor 최적화
        while (targetGroup.length > 0) {
          let minDistance = Infinity;
          let nextIndex = 0;

          for (let i = 0; i < targetGroup.length; i++) {
            const dx = targetGroup[i].x - currentX;
            const dy = targetGroup[i].y - currentY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
              minDistance = distance;
              nextIndex = i;
            }
          }

          const nextTarget = targetGroup.splice(nextIndex, 1)[0];
          optimizedList.push(nextTarget.request);
          currentX = nextTarget.x;
          currentY = nextTarget.y;
        }
      }
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

export default router;

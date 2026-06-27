import { useEffect, useRef, useState } from 'react';

interface DriverMapProps {
  requests: { id: string; address: string; userName: string; status: string; orderIndex?: number }[];
  currentLat?: number;
  currentLng?: number;
}

export default function DriverMap({ requests, currentLat, currentLng }: DriverMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line prefer-const
    let checkInterval: any;

    const initMap = () => {
      const { kakao } = window as any;
      if (!kakao || !kakao.maps || !kakao.maps.load) {
        return; // 아직 카카오맵 스크립트 로딩 전
      }

      if (checkInterval) clearInterval(checkInterval);

      kakao.maps.load(async () => {
        if (!mapContainer.current) return;

        try {
          if (!kakao.maps.services) {
            throw new Error('카카오 지도 서비스(kakao.maps.services)를 불러오지 못했습니다.');
          }
          
          const geocoder = new kakao.maps.services.Geocoder();
          setErrorMsg(null);
          
          // 1. 지도 컨테이너 초기화 및 기본 지도 즉시 생성
          mapContainer.current.innerHTML = '';

          const defaultCenter = new kakao.maps.LatLng(currentLat || 37.2636, currentLng || 127.0286);
          const mapOption = {
            center: defaultCenter,
            level: 6,
          };
          const map = new kakao.maps.Map(mapContainer.current, mapOption);
          const bounds = new kakao.maps.LatLngBounds();
          
          // 지도 렌더링 강제 업데이트
          setTimeout(() => map.relayout(), 100);

          // 현재 위치 마커 추가
          const linePath: any[] = [];
          if (currentLat && currentLng) {
            const startPos = new kakao.maps.LatLng(currentLat, currentLng);
            linePath.push(startPos);
            bounds.extend(startPos);

            new kakao.maps.Marker({
              position: startPos,
              map: map,
              title: '현재 위치 (출발지)'
            });
            
            new kakao.maps.CustomOverlay({
              map: map,
              position: startPos,
              content: `<div style="background-color: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; transform: translateY(-30px); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">출발</div>`
            });
          }

          // 2. 순차적으로 Geocoding 요청 (API Rate Limit 방지)
          setLoadingCoords(true);
          const validResults: any[] = [];
          
          for (let i = 0; i < requests.length; i++) {
            const req = requests[i];
            const result = await new Promise<{ lat: number; lng: number; req: any; index: number }>((resolve) => {
              geocoder.addressSearch(req.address, (result: any, status: any) => {
                if (status === kakao.maps.services.Status.OK) {
                  resolve({
                    lat: parseFloat(result[0].y),
                    lng: parseFloat(result[0].x),
                    req,
                    index: i
                  });
                } else {
                  console.error('Geocoder failed for address:', req.address, status);
                  resolve({ lat: 0, lng: 0, req, index: -1 });
                }
              });
            });
            
            if (result.index !== -1) {
              validResults.push(result);
            }
            // 카카오 API 호출 제한 방지를 위해 150ms 딜레이 추가
            await new Promise(r => setTimeout(r, 150));
          }

          // 3. 지도의 마커 및 선 그리기
          validResults.forEach((res, i) => {
            const pos = new kakao.maps.LatLng(res.lat, res.lng);
            linePath.push(pos);
            bounds.extend(pos);

            const displayIndex = i + 1;
            const isCompleted = res.req.status === 'COMPLETED';
            const isInProgress = res.req.status === 'IN_PROGRESS';

            let bgColor = '#FECACA'; // 옅은 붉은색 (대기중)
            let textColor = '#991B1B'; // 진한 붉은색 글씨
            let borderStyle = '2px solid white';
            let extraStyle = '';
            
            if (isCompleted) {
              bgColor = '#22C55E'; // 초록색 (완료)
              textColor = 'white';
            } else if (isInProgress) {
              bgColor = '#3B82F6'; // 파란색 (가고있는중)
              textColor = 'white';
              borderStyle = '3px solid #DBEAFE'; // 눈에 띄는 테두리
              extraStyle = 'box-shadow: 0 0 12px rgba(59,130,246,0.9); transform: scale(1.2); z-index: 10;'; // 크기 키우고 글로우 효과 (강조)
            }

            const content = `
              <div style="
                background-color: ${bgColor}; 
                color: ${textColor}; 
                width: 30px; height: 30px; 
                border-radius: 50%; 
                display: flex; align-items: center; justify-content: center; 
                font-weight: bold; font-size: 14px;
                border: ${borderStyle};
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                cursor: pointer;
                ${extraStyle}
              ">
                ${displayIndex}
              </div>
            `;

            new kakao.maps.CustomOverlay({
              map: map,
              position: pos,
              content: content,
              yAnchor: 1
            });

            new kakao.maps.CustomOverlay({
              map: map,
              position: pos,
              content: `<div style="background-color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; border: 1px solid #ccc; transform: translateY(15px); white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${res.req.userName}</div>`,
              yAnchor: 0
            });
          });

          // 4. 선 그리기 (안정성 및 시연을 위해 라인 생략, 핀만 표시)
          /*
          if (linePath.length > 1) {
            const polyline = new kakao.maps.Polyline({
              path: linePath,
              strokeWeight: 4,
              strokeColor: '#3B82F6',
              strokeOpacity: 0.8,
              strokeStyle: 'solid'
            });
            polyline.setMap(map);
          }
          */

          // 5. 범위 재설정
          if (validResults.length > 0 || (currentLat && currentLng)) {
            map.setBounds(bounds);
            setTimeout(() => {
              map.relayout();
              map.setBounds(bounds);
              if (map.getLevel() < 3) map.setLevel(3);
            }, 300);
          } else {
            setTimeout(() => {
              map.relayout();
            }, 300);
          }

          setLoadingCoords(false);
        } catch (err: any) {
          console.error('Map draw error:', err);
          setErrorMsg('지도를 그리는 중 오류가 발생했습니다: ' + (err.message || String(err)));
          setLoadingCoords(false);
        }
      });
    };

    checkInterval = setInterval(initMap, 500);
    initMap();

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [requests, currentLat, currentLng]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-sm border border-gray-200" style={{ height: '300px' }}>
      {loadingCoords && (
        <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500 mb-2"></div>
          <p className="text-teal-700 font-bold animate-pulse">최적 동선 계산 중...</p>
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center p-4 text-center">
          <div className="text-red-500 font-bold mb-2">⚠️ 오류 발생</div>
          <p className="text-gray-600 text-sm">{errorMsg}</p>
        </div>
      )}

      <div ref={mapContainer} style={{ width: '100%', height: '300px' }} />
    </div>
  );
}

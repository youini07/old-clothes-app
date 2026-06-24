import { useEffect, useRef, useState } from 'react';

interface DriverMapProps {
  requests: { id: string; address: string; userName: string; status: string; orderIndex?: number }[];
  currentLat?: number;
  currentLng?: number;
}

export default function DriverMap({ requests, currentLat, currentLng }: DriverMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadMap = () => {
      const { kakao } = window as any;
      if (!kakao || !kakao.maps || !kakao.maps.load) {
        setTimeout(loadMap, 500);
        return;
      }

      kakao.maps.load(() => {
        setMapLoaded(true);
      });
    };

    loadMap();
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapContainer.current) return;

    const { kakao } = window as any;
    const geocoder = new kakao.maps.services.Geocoder();

    const drawMap = async () => {
      try {
        setErrorMsg(null);
        
        // 1. 지도 컨테이너 초기화 및 기본 지도 즉시 생성
        if (mapContainer.current) {
          mapContainer.current.innerHTML = '';
        }

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

          const content = `
            <div style="
              background-color: ${isCompleted ? '#9CA3AF' : '#EAB308'}; 
              color: ${isCompleted ? 'white' : '#713F12'}; 
              width: 28px; height: 28px; 
              border-radius: 50%; 
              display: flex; align-items: center; justify-content: center; 
              font-weight: bold; font-size: 14px;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              cursor: pointer;
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

        // 4. 선 그리기
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

        // 5. 범위 재설정
        if (validResults.length > 0 || (currentLat && currentLng)) {
          map.setBounds(bounds);
          setTimeout(() => {
            map.relayout();
            map.setBounds(bounds);
            if (map.getLevel() < 3) map.setLevel(3);
          }, 300);
        }

        setLoadingCoords(false);
      } catch (err: any) {
        console.error('Map draw error:', err);
        setErrorMsg('지도를 그리는 중 오류가 발생했습니다: ' + (err.message || String(err)));
        setLoadingCoords(false);
      }
    };

    drawMap();
  }, [mapLoaded, requests, currentLat, currentLng]);

  return (
    <div className="relative w-full h-[300px] bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      {loadingCoords && (
        <div className="absolute inset-0 z-10 bg-white/70 flex items-center justify-center">
          <div className="text-primary-600 font-bold flex items-center gap-2">
            <div className="w-5 h-5 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            경로 그리는 중...
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center p-4 text-center">
          <div className="text-red-500 font-bold mb-2">⚠️ 오류 발생</div>
          <p className="text-gray-600 text-sm">{errorMsg}</p>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '300px' }} />
    </div>
  );
}

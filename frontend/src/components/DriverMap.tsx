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
        setLoadingCoords(true);
        setErrorMsg(null);
        
        const coordsPromises = requests.map((req, index) => {
          return new Promise<{ lat: number; lng: number; req: any; index: number }>((resolve) => {
            geocoder.addressSearch(req.address, (result: any, status: any) => {
            if (status === kakao.maps.services.Status.OK) {
              resolve({
                lat: parseFloat(result[0].y),
                lng: parseFloat(result[0].x),
                req,
                index
              });
            } else {
              console.error('Geocoder failed for address:', req.address, status);
              // 실패 시 null로 처리
              resolve({ lat: 0, lng: 0, req, index: -1 });
            }
          });
        });
      });

      const results = await Promise.all(coordsPromises);
      const validResults = results.filter(r => r.index !== -1);

      // 항상 지도를 생성하도록 보장
      const centerLat = validResults.length > 0 ? validResults[0].lat : currentLat || 37.2636;
      const centerLng = validResults.length > 0 ? validResults[0].lng : currentLng || 127.0286;

      const mapOption = {
        center: new kakao.maps.LatLng(centerLat, centerLng),
        level: 6, // 넓게 보기
      };

      // 기존 맵 초기화
      if (mapContainer.current) {
        mapContainer.current.innerHTML = '';
      }

      const map = new kakao.maps.Map(mapContainer.current, mapOption);
      const bounds = new kakao.maps.LatLngBounds();

      // 선을 그리기 위한 경로 좌표 배열
      const linePath: any[] = [];

      // 현재 위치가 있다면 출발지 마커 추가
      if (currentLat && currentLng) {
        const startPos = new kakao.maps.LatLng(currentLat, currentLng);
        linePath.push(startPos);
        bounds.extend(startPos);

        new kakao.maps.Marker({
          position: startPos,
          map: map,
          title: '현재 위치 (출발지)'
        });
        
        // 커스텀 오버레이로 '출발' 표시
        new kakao.maps.CustomOverlay({
          map: map,
          position: startPos,
          content: `<div style="background-color: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; transform: translateY(-30px); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">출발</div>`
        });
      }

      // 각 수거지 마커 및 선 경로 추가
      validResults.forEach((res, i) => {
        const pos = new kakao.maps.LatLng(res.lat, res.lng);
        linePath.push(pos);
        bounds.extend(pos);

        // 마커 번호 (출발지 0, 이후 1, 2, 3...)
        const displayIndex = i + 1;
        const isCompleted = res.req.status === 'COMPLETED';

        // 번호가 적힌 마커 이미지 (HTML 커스텀 오버레이로 구현)
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
          yAnchor: 1 // 마커의 끝을 좌표에 맞춤
        });

        // 장소 이름/고객명 오버레이
        new kakao.maps.CustomOverlay({
          map: map,
          position: pos,
          content: `<div style="background-color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; border: 1px solid #ccc; transform: translateY(15px); white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${res.req.userName}</div>`,
          yAnchor: 0
        });
      });

      // 지도에 다중 선 그리기
      if (linePath.length > 1) {
        const polyline = new kakao.maps.Polyline({
          path: linePath, // 선을 구성하는 좌표배열 입니다
          strokeWeight: 4, // 선의 두께 입니다
          strokeColor: '#3B82F6', // 선의 색깔입니다
          strokeOpacity: 0.8, // 선의 불투명도 입니다 1에서 0 사이의 값이며 0에 가까울수록 투명합니다
          strokeStyle: 'solid' // 선의 스타일입니다
        });
        polyline.setMap(map);
      }

      // 모든 마커가 보이도록 지도 범위 재설정
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

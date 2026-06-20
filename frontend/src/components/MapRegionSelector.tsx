import React, { useEffect, useRef, useState } from 'react';

interface MapRegionSelectorProps {
  onRegionSelect?: (regionInfo: { province: string; city: string; town: string }) => void;
}

export default function MapRegionSelector({ onRegionSelect }: MapRegionSelectorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  useEffect(() => {
    let checkInterval: any;

    const initMap = () => {
      const kakao = (window as any).kakao;
      // 아직 카카오맵 기본 객체가 없다면 대기
      if (!kakao || !kakao.maps || !kakao.maps.load) {
        return;
      }

      // 스크립트가 로드되었다면 타이머 중지
      if (checkInterval) clearInterval(checkInterval);

      kakao.maps.load(() => {
        if (!mapContainer.current) return;

        // 기존 지도 초기화 (React StrictMode 중복 렌더링 방지)
        mapContainer.current.innerHTML = '';

        const options = {
          center: new kakao.maps.LatLng(37.2636, 127.0286),
          level: 8,
        };

        const map = new kakao.maps.Map(mapContainer.current, options);
        const geocoder = new kakao.maps.services.Geocoder();
        const marker = new kakao.maps.Marker();
        
        // 시각적 효과를 위한 파란색 반투명 원 생성 (반경 1.5km)
        const circle = new kakao.maps.Circle({
          center: new kakao.maps.LatLng(37.2636, 127.0286), // 초기화용 (나중에 클릭 지점으로 변경됨)
          radius: 1500, // 미터 단위 (1.5km)
          strokeWeight: 2,
          strokeColor: '#2563EB', // Tailwind blue-600
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: '#3B82F6', // Tailwind blue-500
          fillOpacity: 0.25 
        });

        kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          const latlng = mouseEvent.latLng;
          
          // 마커 위치 이동
          marker.setPosition(latlng);
          marker.setMap(map);

          // 파란색 원 위치 이동
          circle.setPosition(latlng);
          circle.setMap(map);

          geocoder.coord2RegionCode(latlng.getLng(), latlng.getLat(), (result: any, status: any) => {
            if (status === kakao.maps.services.Status.OK) {
              const regionData = result.find((res: any) => res.region_type === 'H') || result[0];
              if (regionData) {
                const province = regionData.region_1depth_name;
                const city = regionData.region_2depth_name;
                const town = regionData.region_3depth_name;

                const addressText = `${province} ${city} ${town}`.trim();
                setSelectedAddress(addressText);

                if (onRegionSelect) {
                  onRegionSelect({ province, city, town });
                }
              }
            }
          });
        });
      });
    };

    // 0.2초마다 카카오맵 로드 여부 체크 (최대 5초)
    checkInterval = setInterval(initMap, 200);
    initMap(); // 최초 1회 즉시 실행

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [onRegionSelect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">권역(지도) 선택</h3>
        {selectedAddress && (
          <span className="px-3 py-1 text-sm font-medium text-blue-800 bg-blue-100 rounded-full">
            선택됨: {selectedAddress}
          </span>
        )}
      </div>
      
      {/* 지도 렌더링 영역 */}
      <div 
        ref={mapContainer} 
        className="w-full h-[400px] rounded-xl border border-gray-300 shadow-inner overflow-hidden relative"
      >
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
          지도를 불러오는 중... (API 키 필요)
        </div>
      </div>
      
      <p className="text-sm text-gray-500">
        * 지도를 클릭하면 해당 위치의 행정구역(동 단위)을 서비스 권역으로 선택할 수 있습니다.
      </p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

interface MapRegionSelectorProps {
  onRegionSelect?: (regionInfo: { province: string; city: string; town: string }) => void;
}

// 클릭으로 받아온 주소 정보
interface ClickedRegion {
  province: string;
  city: string;
  town: string;
}

export default function MapRegionSelector({ onRegionSelect }: MapRegionSelectorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // 지도 클릭으로 읽어온 원본 주소 (시, 동 포함 전체)
  const [clickedRegion, setClickedRegion] = useState<ClickedRegion | null>(null);
  // 사용자가 선택한 범위: 'city' = 시 전체, 'town' = 해당 동만
  const [scopeMode, setScopeMode] = useState<'city' | 'town'>('town');

  // 클릭된 지역 또는 범위 모드가 바뀌면 상위에 알려줌
  useEffect(() => {
    if (!clickedRegion || !onRegionSelect) return;

    if (scopeMode === 'city') {
      // 시 전체 할당: town을 '전체'로 보냄 (백엔드에서 null로 처리)
      onRegionSelect({ province: clickedRegion.province, city: clickedRegion.city, town: '전체' });
    } else {
      // 해당 동만 할당
      onRegionSelect({ province: clickedRegion.province, city: clickedRegion.city, town: clickedRegion.town });
    }
  }, [clickedRegion, scopeMode]);

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
          center: new kakao.maps.LatLng(37.2636, 127.0286),
          radius: 1500,
          strokeWeight: 2,
          strokeColor: '#2563EB',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: '#3B82F6',
          fillOpacity: 0.25 
        });

        kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          const latlng = mouseEvent.latLng;
          
          marker.setPosition(latlng);
          marker.setMap(map);

          circle.setPosition(latlng);
          circle.setMap(map);

          geocoder.coord2RegionCode(latlng.getLng(), latlng.getLat(), (result: any, status: any) => {
            if (status === kakao.maps.services.Status.OK) {
              const regionData = result.find((res: any) => res.region_type === 'H') || result[0];
              if (regionData) {
                const province = regionData.region_1depth_name;
                const city = regionData.region_2depth_name;
                const town = regionData.region_3depth_name;

                // 클릭된 지역 정보를 상태에 저장 (UI 토글이 결정하여 onRegionSelect로 전달)
                setClickedRegion({ province, city, town });
              }
            }
          });
        });
      });
    };

    checkInterval = setInterval(initMap, 200);
    initMap();

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  // 현재 선택된 지역 요약 텍스트
  const selectedSummary = clickedRegion
    ? scopeMode === 'city'
      ? `${clickedRegion.province} ${clickedRegion.city} 전체`
      : `${clickedRegion.province} ${clickedRegion.city} ${clickedRegion.town}`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">권역(지도) 선택</h3>
        {selectedSummary && (
          <span className="px-3 py-1 text-sm font-medium text-blue-800 bg-blue-100 rounded-full">
            선택됨: {selectedSummary}
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

      {/* 지도 클릭 후 범위 선택 UI */}
      {clickedRegion && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            📍 클릭한 위치: <span className="text-gray-900">{clickedRegion.province} {clickedRegion.city} {clickedRegion.town}</span>
          </p>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">할당 범위 선택</p>
            <div className="flex gap-2">
              {/* 해당 동만 */}
              <button
                type="button"
                onClick={() => setScopeMode('town')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 ${
                  scopeMode === 'town'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                }`}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg">📌</span>
                  <span>{clickedRegion.town} 만</span>
                  <span className="text-xs opacity-75 font-normal">동 단위</span>
                </div>
              </button>

              {/* 시 전체 */}
              <button
                type="button"
                onClick={() => setScopeMode('city')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 ${
                  scopeMode === 'city'
                    ? 'border-green-600 bg-green-600 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                }`}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg">🗺️</span>
                  <span>{clickedRegion.city} 전체</span>
                  <span className="text-xs opacity-75 font-normal">시·군 단위</span>
                </div>
              </button>
            </div>
          </div>
          <div className={`p-3 rounded-lg text-sm font-semibold ${
            scopeMode === 'city' ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'
          }`}>
            {scopeMode === 'city'
              ? `✅ ${clickedRegion.city} 전역의 모든 수거 신청을 담당합니다.`
              : `✅ ${clickedRegion.town} 지역의 수거 신청만 담당합니다.`
            }
          </div>
        </div>
      )}
      
      <p className="text-sm text-gray-500">
        * 지도를 클릭한 후, <strong>동 단위</strong> 또는 <strong>시 전체</strong> 중 할당 범위를 선택하세요.
      </p>
    </div>
  );
}

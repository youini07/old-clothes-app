import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { MapPin, CheckSquare, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

declare global {
  interface Window {
    kakao: any;
  }
}

function extractKg(volumeStr: string): number {
  if (!volumeStr) return 0;
  
  // 1. "OOkg" 명시된 경우
  const kgMatch = volumeStr.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) return parseFloat(kgMatch[1]);
  
  // 2. "OOL" (리터) 명시된 경우 (예: 100L -> 약 15kg 추정)
  const lMatch = volumeStr.match(/(\d+(?:\.\d+)?)\s*L/i);
  if (lMatch) return parseFloat(lMatch[1]) * 0.15;
  
  // 3. 포대, 박스, 봉투 등 (예: 3포대 -> 45kg)
  const sackMatch = volumeStr.match(/(\d+)\s*(포대|박스|봉투|개)/);
  if (sackMatch) return parseInt(sackMatch[1]) * 15; 

  // 4. 숫자만 있는 경우
  const numMatch = volumeStr.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    return num > 10 ? num : num * 15;
  }
  
  return 0;
}

interface RequestItem {
  id: string;
  userName: string;
  phone: string;
  address: string;
  detailAddress: string;
  estimatedVolume: string;
  status: string;
  partnerId: string | null;
  driverId: string | null;
  actualWeight?: number;
}

interface Driver {
  id: string;
  user?: { name: string; phone?: string };
  name?: string;
}

interface AdminMapDispatchProps {
  requests: RequestItem[];
  drivers: Driver[];
  onAssigned: () => void;
  authToken: string | null;
}

export default function AdminMapDispatch({ requests, drivers, onAssigned, authToken }: AdminMapDispatchProps) {
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [unassignedRequests, setUnassignedRequests] = useState<(RequestItem & { lat?: number; lng?: number; marker?: any })[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // 미배정 건 필터링
  useEffect(() => {
    const unassigned = requests.filter(r => r.status === 'ASSIGNED' && !r.driverId);
    setUnassignedRequests(unassigned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  // 카카오맵 스크립트 로드 확인
  useEffect(() => {
    const checkMap = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          setMapLoaded(true);
        });
      } else {
        setTimeout(checkMap, 500);
      }
    };
    checkMap();
  }, []);

  // 지도 초기화 및 마커 렌더링
  useEffect(() => {
    if (!mapLoaded || unassignedRequests.length === 0) return;

    if (!mapRef.current) {
      const container = document.getElementById('admin-dispatch-map');
      if (!container) return;

      const options = {
        center: new window.kakao.maps.LatLng(37.566826, 126.9786567),
        level: 8
      };

      const map = new window.kakao.maps.Map(container, options);
      mapRef.current = map;
      
      const clusterer = new window.kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: true
      });
      clustererRef.current = clusterer;

      // 클러스터 클릭 시 포함된 마커들 모두 선택
      window.kakao.maps.event.addListener(clusterer, 'clusterclick', function(cluster: any) {
        const markers = cluster.getMarkers();
        const newIds = markers.map((m: any) => m.requestId).filter(Boolean);
        
        setSelectedIds(prev => {
          const prevSet = new Set(prev);
          newIds.forEach((id: string) => prevSet.add(id));
          return Array.from(prevSet);
        });
      });
    }

    const map = mapRef.current;
    const clusterer = clustererRef.current;
    const geocoder = new window.kakao.maps.services.Geocoder();

    // 기존 마커 제거
    clusterer.clear();

    const bounds = new window.kakao.maps.LatLngBounds();
    let boundsExtended = false;
    let loadedCount = 0;

    unassignedRequests.forEach((req) => {
      // 이미 좌표가 있다면
      if (req.lat && req.lng) {
        createMarker(req, req.lat, req.lng);
      } else {
        // 주소로 좌표 검색
        geocoder.addressSearch(req.address, (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK) {
            const lat = Number(result[0].y);
            const lng = Number(result[0].x);
            req.lat = lat;
            req.lng = lng;
            createMarker(req, lat, lng);
          }
          loadedCount++;
          if (loadedCount === unassignedRequests.length && boundsExtended) {
            map.setBounds(bounds);
          }
        });
      }
    });

    function createMarker(req: RequestItem & { lat?: number; lng?: number; marker?: any }, lat: number, lng: number) {
      const position = new window.kakao.maps.LatLng(lat, lng);
      
      const isSelected = selectedIds.includes(req.id);
      const orderIndex = selectedIds.indexOf(req.id) + 1;

      const estimatedKg = extractKg(req.estimatedVolume);
      
      const markerBg = isSelected ? 'bg-orange-500' : 'bg-white';
      const markerBorder = isSelected ? 'border-white' : 'border-orange-500';
      const markerText = isSelected ? 'text-white' : 'text-orange-600';
      const pointerBg = isSelected ? 'bg-orange-500' : 'bg-white';
      const pointerBorder = isSelected ? 'border-white' : 'border-orange-500';

      // 커스텀 오버레이 내용 구성
      const content = document.createElement('div');
      content.className = `relative cursor-pointer transform hover:scale-110 transition-transform flex flex-col items-center ${isSelected ? 'z-50' : 'z-10'}`;
      content.innerHTML = `
        <div class="flex items-center justify-center w-12 h-12 rounded-full shadow-2xl border-4 ${markerBg} ${markerBorder} ${markerText}">
          <span class="text-xl font-black">${isSelected ? orderIndex : '?'}</span>
        </div>
        <div class="w-3 h-3 ${pointerBg} rotate-45 border-r-4 border-b-4 ${pointerBorder} -mt-1.5 z-0"></div>
        <div class="mt-1 px-2.5 py-1 bg-white/95 backdrop-blur-md rounded-lg text-xs font-extrabold text-gray-800 shadow-lg border-2 border-gray-200 whitespace-nowrap">
          ${estimatedKg > 0 ? estimatedKg + 'kg' : req.estimatedVolume || '무게 미상'}
        </div>
      `;

      // 클릭 이벤트 리스너 추가 (React 상태 업데이트를 위해 DOM 이벤트 사용)
      content.onclick = () => {
        setSelectedIds(prev => {
          if (prev.includes(req.id)) {
            return prev.filter(id => id !== req.id);
          } else {
            return [...prev, req.id];
          }
        });
      };

      const customOverlay = new window.kakao.maps.CustomOverlay({
        position: position,
        content: content,
        yAnchor: 1
      });
      
      // 클러스터 클릭 시 ID를 가져오기 위해 커스텀 프로퍼티 추가
      (customOverlay as any).requestId = req.id;

      customOverlay.setMap(map);
      req.marker = customOverlay; // 나중에 지우기 위해 참조 저장
      
      clusterer.addMarker(customOverlay);
      bounds.extend(position);
      boundsExtended = true;

      // 이미 모든 좌표가 있다면 바운드 조정
      if (unassignedRequests.every(r => r.lat && r.lng) && boundsExtended) {
        map.setBounds(bounds);
      }
    }

    return () => {
      // Cleanup: 현재 렌더링된 마커들 제거
      unassignedRequests.forEach(req => {
        if (req.marker) {
          req.marker.setMap(null);
        }
      });
      clusterer.clear();
    };
  }, [mapLoaded, unassignedRequests, selectedIds]);

  const handleBatchAssign = async () => {
    if (selectedIds.length === 0) {
      alert('배정할 수거 건을 지도에서 선택해주세요.');
      return;
    }
    if (!selectedDriverId) {
      alert('배정할 기사님을 선택해주세요.');
      return;
    }

    setIsAssigning(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/admin/requests/batch-assign-driver`,
        {
          requestIds: selectedIds,
          driverId: selectedDriverId
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      alert(`${selectedIds.length}건이 성공적으로 배정되었습니다.`);
      setSelectedIds([]);
      onAssigned();
    } catch (error: any) {
      console.error(error);
      alert('일괄 배정 중 오류가 발생했습니다.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSelectAll = () => {
    // 현재 지도에 보이는 미배정 건 전체 선택
    const allIds = unassignedRequests.map(r => r.id);
    setSelectedIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const totalEstimatedKg = selectedIds.reduce((sum, id) => {
    const req = unassignedRequests.find(r => r.id === id);
    return sum + (req ? extractKg(req.estimatedVolume) : 0);
  }, 0);

  return (
    <div className="flex flex-col h-[700px] bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* 맵 컨테이너 */}
      <div id="admin-dispatch-map" className="w-full h-full bg-gray-100 z-0"></div>

      {/* 우측 상단 컨트롤 패널 */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-gray-100 z-10 w-80">
        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-500" />
          지도 배정
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          미배정 수거건: <strong className="text-orange-600">{unassignedRequests.length}</strong>건
        </p>
        
        <div className="flex gap-2 mb-4">
          <button 
            onClick={handleSelectAll}
            className="flex-1 text-xs font-bold py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-1"
          >
            <CheckSquare className="w-3 h-3" /> 전체 선택
          </button>
          <button 
            onClick={handleClearSelection}
            className="flex-1 text-xs font-bold py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> 선택 해제
          </button>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="mb-2 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700">선택됨</span>
            <span className="text-lg font-black text-orange-600">{selectedIds.length}건</span>
          </div>

          {selectedIds.length > 0 && (
            <div className="mb-4 space-y-3">
              {/* 예상 무게 요약 */}
              <div className={`p-3 rounded-xl border ${totalEstimatedKg >= 800 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-gray-600">총 예상 무게</span>
                  <span className={`text-sm font-black ${totalEstimatedKg >= 800 ? 'text-red-600' : 'text-gray-800'}`}>
                    약 {totalEstimatedKg}kg
                  </span>
                </div>
                {totalEstimatedKg >= 800 && (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-red-500 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>한 차량 권장 적재량(800kg) 초과 예상!</span>
                  </div>
                )}
                {totalEstimatedKg < 800 && totalEstimatedKg > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min((totalEstimatedKg / 800) * 100, 100)}%` }}></div>
                  </div>
                )}
              </div>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="" disabled>배정할 기사 선택...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.user?.name || d.name} 기사님</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleBatchAssign}
            disabled={selectedIds.length === 0 || !selectedDriverId || isAssigning}
            className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            {isAssigning ? '배정 중...' : (
              <>
                <CheckCircle className="w-4 h-4" /> 일괄 배정하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

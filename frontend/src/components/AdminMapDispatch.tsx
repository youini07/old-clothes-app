import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { MapPin, CheckSquare, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import Spinner from './Spinner';

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
  partnerAddress?: string;
  partnerBusinessName?: string;
}

export default function AdminMapDispatch({ requests, drivers, onAssigned, authToken, partnerAddress, partnerBusinessName }: AdminMapDispatchProps) {
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const isInitialBoundsSet = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [unassignedRequests, setUnassignedRequests] = useState<(RequestItem & { lat?: number; lng?: number; marker?: any })[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [failedRequests, setFailedRequests] = useState<RequestItem[]>([]);

  // 미배정 건 필터링
  useEffect(() => {
    const unassigned = requests.filter(r => r.status === 'ASSIGNED' && !r.driverId);
    setUnassignedRequests(unassigned);
     
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
        const newIds = markers.flatMap((m: any) => m.requestIds || [m.requestId]).filter(Boolean);
        
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
    setFailedRequests([]);

    const bounds = new window.kakao.maps.LatLngBounds();
    let boundsExtended = false;
    let loadedCount = 0;

    // 중복 좌표를 방지하기 위해 각 요청을 개별 마커로 처리하며,
    // 같은 좌표(또는 거의 같은 좌표)일 경우 약간의 오프셋을 주어 겹치지 않게 배치합니다.
    const uniqueAddresses = Array.from(new Set(unassignedRequests.map(r => r.address || 'unknown')));
    
    // 좌표별 마커 개수를 추적하여 오프셋(퍼짐) 계산
    const coordCounts: { [key: string]: number } = {};

    uniqueAddresses.forEach(address => {
      const reqsWithAddr = unassignedRequests.filter(r => (r.address || 'unknown') === address);
      const firstReq = reqsWithAddr[0];
      
      if ((firstReq as any).lat && (firstReq as any).lng) {
        processGeocoded(reqsWithAddr, (firstReq as any).lat, (firstReq as any).lng);
      } else {
        geocoder.addressSearch(address, (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK) {
            const lat = Number(result[0].y);
            const lng = Number(result[0].x);
            reqsWithAddr.forEach(r => { (r as any).lat = lat; (r as any).lng = lng; });
            processGeocoded(reqsWithAddr, lat, lng);
          } else {
            setFailedRequests(prev => {
              const newFails = [...prev];
              reqsWithAddr.forEach(r => {
                if (!newFails.find(fr => fr.id === r.id)) {
                  newFails.push(r);
                }
              });
              return newFails;
            });
            checkBounds();
          }
        });
      }
    });

    function processGeocoded(reqs: RequestItem[], lat: number, lng: number) {
      reqs.forEach((req) => {
        // 소수점 4자리(약 10m) 단위로 같은 위치인지 판별
        const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        const count = coordCounts[coordKey] || 0;
        coordCounts[coordKey] = count + 1;
        
        let finalLat = lat;
        let finalLng = lng;
        
        if (count > 0) {
          // 중복 마커일 경우 나선형(원형)으로 약간씩 벌려서 배치 (약 15m 간격)
          const offsetRadius = 0.00015 * Math.ceil(count / 6); 
          const angle = count * (Math.PI * 2) / 6; 
          finalLat += offsetRadius * Math.cos(angle);
          finalLng += offsetRadius * Math.sin(angle);
        }
        
        createSingleMarker(req, finalLat, finalLng);
      });
      checkBounds();
    }

    function checkBounds() {
      loadedCount++;
      if (loadedCount === uniqueAddresses.length && boundsExtended) {
        if (!isInitialBoundsSet.current) {
          map.setBounds(bounds);
          isInitialBoundsSet.current = true;
        }
      }
    }

    function createSingleMarker(req: RequestItem, lat: number, lng: number) {
      const position = new window.kakao.maps.LatLng(lat, lng);
      
      const isSelected = selectedIds.includes(req.id);
      const selectedOrder = isSelected ? selectedIds.indexOf(req.id) + 1 : 0;
      const kg = extractKg(req.estimatedVolume);
      
      let markerBg = isSelected ? 'bg-orange-500' : 'bg-white';
      let markerBorder = isSelected ? 'border-white' : 'border-orange-500';
      let markerText = isSelected ? 'text-white' : 'text-orange-600';
      
      const centerText = `<span class="${isSelected ? 'text-xl' : 'text-[11px] tracking-tighter'} font-black pointer-events-none">${isSelected ? selectedOrder : '미배정'}</span>`;

      // 커스텀 오버레이 내용 구성
      const content = document.createElement('div');
      content.className = `relative transform hover:scale-110 transition-transform flex flex-col items-center pointer-events-none ${isSelected ? 'z-50' : 'z-10'}`;
      content.innerHTML = `
        <div class="pointer-events-auto cursor-pointer flex items-center justify-center w-12 h-12 rounded-full shadow-2xl border-4 ${markerBg} ${markerBorder} ${markerText}">
          ${centerText}
        </div>
        <div class="pointer-events-none w-3 h-3 ${markerBg} rotate-45 border-r-4 border-b-4 ${markerBorder} -mt-1.5 z-0"></div>
        <div class="pointer-events-auto cursor-pointer mt-1 px-2.5 py-1 bg-white/95 backdrop-blur-md rounded-lg text-xs font-extrabold text-gray-800 shadow-lg border-2 border-gray-200 whitespace-nowrap">
          ${kg > 0 ? kg + 'kg' : '무상'}
        </div>
      `;

      // 클릭 이벤트 리스너 추가
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
        yAnchor: 1,
        clickable: true // 오버레이 클릭 이벤트를 활성화하기 위해 필수
      });
      
      // 클러스터 클릭 시 ID를 가져오기 위해 커스텀 프로퍼티 추가
      (customOverlay as any).requestIds = [req.id];

      customOverlay.setMap(map);
      
      // 나중에 지우기 위해 unassignedRequests 원본에 marker 참조 저장
      const originalReq = unassignedRequests.find(r => r.id === req.id);
      if (originalReq) {
        (originalReq as any).marker = customOverlay;
      }
      
      clusterer.addMarker(customOverlay);
      bounds.extend(position);
      boundsExtended = true;
    }

    // 회사(사장님) 마커 렌더링
    if (partnerAddress) {
      geocoder.addressSearch(partnerAddress, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const partnerPos = new window.kakao.maps.LatLng(Number(result[0].y), Number(result[0].x));
          bounds.extend(partnerPos);
          
          const content = document.createElement('div');
          content.className = "relative flex flex-col items-center z-[100] cursor-pointer";
          content.innerHTML = `
            <div class="flex items-center justify-center w-12 h-12 rounded-full shadow-2xl border-4 bg-amber-500 border-white text-white z-[100]">
              <span class="text-2xl">🏢</span>
            </div>
            <div class="mt-1 px-3 py-1.5 bg-amber-500 rounded-lg text-sm font-extrabold text-white shadow-lg border-2 border-white whitespace-nowrap z-[100]">
              ${partnerBusinessName || '회사'}
            </div>
          `;
          
          new window.kakao.maps.CustomOverlay({
            map: map,
            position: partnerPos,
            content: content,
            yAnchor: 1,
            zIndex: 100
          });
          
          if (!isInitialBoundsSet.current) {
            map.setBounds(bounds);
          }
        }
      });
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
    <div className="flex flex-col h-[540px] md:h-[700px] bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* 맵 컨테이너 */}
      <div id="admin-dispatch-map" className="w-full h-full bg-gray-100 z-0"></div>

      {/* 우측 상단 컨트롤 패널 (모바일 극강 최적화) */}
      <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-auto sm:right-4 bg-white/95 backdrop-blur-md p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 z-10 w-auto sm:w-80 max-h-[35vh] sm:max-h-[80vh] overflow-y-auto">
        
        {/* 상단: 타이틀 및 기본 버튼 */}
        <div className="flex flex-col sm:flex-col gap-1.5 sm:gap-4 mb-1 sm:mb-4">
          <div className="flex justify-between items-center">
            {/* 데스크탑 타이틀 */}
            <h3 className="hidden sm:flex text-lg font-bold text-gray-900 items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              지도 배정
            </h3>
            {/* 데스크탑 미배정 건수 */}
            <div className="hidden sm:block text-sm text-gray-600">
              미배정: <strong className="text-orange-600">{unassignedRequests.length}</strong>건
              {failedRequests.length > 0 && (
                <span className="ml-2 text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md" title="잘못된 주소로 지도에 표시되지 않은 건수입니다.">
                  위치 오류: {failedRequests.length}건
                </span>
              )}
            </div>

            {/* 모바일 타이틀 + 미배정 건수 */}
            <div className="sm:hidden flex flex-col items-start gap-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-800">
                <MapPin className="w-3 h-3 text-orange-500" />
                미배정 <span className="text-orange-600">{unassignedRequests.length}</span>건
              </div>
              {failedRequests.length > 0 && (
                <div className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">
                  위치 오류 {failedRequests.length}건
                </div>
              )}
            </div>
            
            {/* 모바일 전체선택/해제 버튼 */}
            <div className="flex sm:hidden gap-1">
              <button onClick={handleSelectAll} className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg border border-gray-200 active:bg-gray-200">
                전체선택
              </button>
              <button onClick={handleClearSelection} className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg border border-gray-200 active:bg-gray-200">
                선택해제
              </button>
            </div>
          </div>
          
          {/* 데스크탑 전체선택/해제 버튼 */}
          <div className="hidden sm:flex gap-2">
            <button onClick={handleSelectAll} className="flex-1 text-xs font-bold py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-1">
              <CheckSquare className="w-3 h-3" /> 전체 선택
            </button>
            <button onClick={handleClearSelection} className="flex-1 text-xs font-bold py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-1">
              <Trash2 className="w-3 h-3" /> 선택 해제
            </button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="border-t border-gray-200 pt-1.5 sm:pt-4">
            {/* 데스크탑 선택됨 건수 */}
            <div className="hidden sm:flex mb-2 justify-between items-center">
              <span className="text-sm font-bold text-gray-700">선택됨</span>
              <span className="text-lg font-black text-orange-600">{selectedIds.length}건</span>
            </div>

            <div className="space-y-1.5 sm:space-y-3">
              {/* 예상 무게 요약 */}
              <div className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl border flex sm:block items-center justify-between ${totalEstimatedKg >= 800 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                {/* 모바일 텍스트 */}
                <div className="sm:hidden text-[10px] font-bold text-gray-700">
                  선택: <span className="text-orange-600">{selectedIds.length}</span>건 (약 {totalEstimatedKg}kg)
                </div>
                
                {/* 데스크탑 텍스트 */}
                <div className="hidden sm:flex justify-between items-center mb-1 w-full">
                  <span className="text-xs font-bold text-gray-600">총 예상 무게</span>
                  <span className={`text-sm font-black ${totalEstimatedKg >= 800 ? 'text-red-600' : 'text-gray-800'}`}>
                    약 {totalEstimatedKg}kg
                  </span>
                </div>
                
                {totalEstimatedKg >= 800 && (
                  <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-red-500 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>권장 적재량(800kg) 초과 예상!</span>
                  </div>
                )}
                {totalEstimatedKg < 800 && totalEstimatedKg > 0 && (
                  <div className="hidden sm:block w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min((totalEstimatedKg / 800) * 100, 100)}%` }}></div>
                  </div>
                )}
              </div>
              
              {/* 기사 선택 및 배정 버튼 (모바일 가로 배치) */}
              <div className="flex flex-row sm:flex-col gap-1.5 sm:gap-3">
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="flex-1 sm:w-full bg-white sm:bg-gray-50 border border-gray-300 sm:border-gray-200 rounded-lg sm:rounded-xl py-1 sm:py-2 px-1.5 sm:px-3 text-[11px] sm:text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="" disabled>기사 선택...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.user?.name || d.name}</option>
                  ))}
                </select>

                <button
                  onClick={handleBatchAssign}
                  disabled={selectedIds.length === 0 || !selectedDriverId || isAssigning}
                  className="whitespace-nowrap px-3 py-1 sm:w-full sm:py-3 text-[11px] sm:text-base bg-orange-500 text-white font-bold rounded-lg sm:rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors flex items-center justify-center gap-1 sm:gap-2"
                >
                  {isAssigning && <Spinner className="w-4 h-4 text-white" />}
                  {isAssigning ? '배정중..' : (
                    <>
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">일괄 </span>배정
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

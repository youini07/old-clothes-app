import { useEffect, useRef, useState } from 'react';

interface DriverMapProps {
  requests: { id: string; address: string; userName: string; status: string; orderIndex?: number }[];
  currentLat?: number;
  currentLng?: number;
  partnerAddress?: string;
  partnerBusinessName?: string;
  onSaveRouteOrder?: (orderedIds: string[]) => void;
}

export default function DriverMap({ requests, currentLat, currentLng, partnerAddress, partnerBusinessName, onSaveRouteOrder }: DriverMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const boundsRef = useRef<any>(null);
  
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [cachedCoords, setCachedCoords] = useState<any[]>([]);
  
  const [isSettingOrder, setIsSettingOrder] = useState(false);
  const [clickedOrder, setClickedOrder] = useState<string[]>([]);

  // 1. 지도 컨테이너 초기화
  useEffect(() => {
    let checkInterval: any;
    const initMap = () => {
      const { kakao } = window as any;
      if (!kakao || !kakao.maps || !kakao.maps.load) return;
      
      if (checkInterval) clearInterval(checkInterval);

      kakao.maps.load(() => {
        if (!mapContainer.current) return;
        if (!kakao.maps.services) {
          setErrorMsg('카카오 지도 서비스를 불러오지 못했습니다.');
          return;
        }
        
        mapContainer.current.innerHTML = '';
        const defaultCenter = new kakao.maps.LatLng(currentLat || 37.2636, currentLng || 127.0286);
        const mapOption = {
          center: defaultCenter,
          level: 6,
        };
        mapInstanceRef.current = new kakao.maps.Map(mapContainer.current, mapOption);
        boundsRef.current = new kakao.maps.LatLngBounds();
        setTimeout(() => mapInstanceRef.current?.relayout(), 100);
      });
    };

    checkInterval = setInterval(initMap, 500);
    initMap();

    return () => clearInterval(checkInterval);
  }, []);

  // 2. 주소 -> 좌표 변환 (requests가 바뀔 때만)
  useEffect(() => {
    if (requests.length === 0) {
      setCachedCoords([]);
      return;
    }
    
    let isCancelled = false;
    
    const fetchCoords = async () => {
      const { kakao } = window as any;
      if (!kakao || !kakao.maps || !kakao.maps.services) return;
      const geocoder = new kakao.maps.services.Geocoder();
      
      setLoadingCoords(true);
      const validResults: any[] = [];
      
      for (let i = 0; i < requests.length; i++) {
        if (isCancelled) break;
        const req = requests[i];
        const result = await new Promise<{ lat: number; lng: number; req: any; index: number; overlapIndex?: number }>((resolve) => {
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
          // 중복 좌표 체크 (아파트 등 동일 주소지)
          const overlapCount = validResults.filter(
            r => Math.abs(r.lat - result.lat) < 0.00001 && Math.abs(r.lng - result.lng) < 0.00001
          ).length;
          
          result.overlapIndex = overlapCount;
          validResults.push(result);
        }
        await new Promise(r => setTimeout(r, 150)); // Rate limit 방지
      }
      
      if (!isCancelled) {
        setCachedCoords(validResults);
        setLoadingCoords(false);
      }
    };

    const checkInt = setInterval(() => {
      const { kakao } = window as any;
      if (kakao && kakao.maps && kakao.maps.services) {
        clearInterval(checkInt);
        fetchCoords();
      }
    }, 500);

    return () => {
      isCancelled = true;
      clearInterval(checkInt);
    };
  }, [requests]);

  // 3. 마커 렌더링 (좌표, 순서 지정 모드, 클릭 상태에 따라 변경)
  useEffect(() => {
    const { kakao } = window as any;
    if (!kakao || !kakao.maps || !mapInstanceRef.current || !boundsRef.current) return;
    
    const map = mapInstanceRef.current;
    const bounds = new kakao.maps.LatLngBounds();
    let hasBounds = false;
    
    // 기존 오버레이 모두 제거
    overlaysRef.current.forEach(overlay => overlay.setMap(null));
    overlaysRef.current = [];

    // 출발지 마커
    if (currentLat && currentLng) {
      const startPos = new kakao.maps.LatLng(currentLat, currentLng);
      bounds.extend(startPos);
      hasBounds = true;

      const overlay = new kakao.maps.CustomOverlay({
        map: map,
        position: startPos,
        content: `<div style="background-color: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; transform: translateY(-15px); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">출발</div>`
      });
      overlaysRef.current.push(overlay);
    }

    // 파트너(회사) 마커
    if (partnerAddress && kakao.maps.services) {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(partnerAddress, (result: any, status: any) => {
        if (status === kakao.maps.services.Status.OK) {
          const partnerPos = new kakao.maps.LatLng(parseFloat(result[0].y), parseFloat(result[0].x));
          bounds.extend(partnerPos);
          
          const iconOverlay = new kakao.maps.CustomOverlay({
            map: map,
            position: partnerPos,
            content: `<div style="background-color: #F59E0B; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4); z-index: 100;">🏢</div>`,
            yAnchor: 1,
            zIndex: 100
          });
          
          const textOverlay = new kakao.maps.CustomOverlay({
            map: map,
            position: partnerPos,
            content: `<div style="background-color: #F59E0B; color: white; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: bold; border: 2px solid white; transform: translateY(15px); white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 100;">${partnerBusinessName || '회사'}</div>`,
            yAnchor: 0,
            zIndex: 100
          });
          
          iconOverlay.setMap(map);
          textOverlay.setMap(map);
          overlaysRef.current.push(iconOverlay, textOverlay);
          
          map.setBounds(bounds);
        }
      });
    }

    // 수거지 마커들 렌더링
    cachedCoords.forEach((res, i) => {
      const pos = new kakao.maps.LatLng(res.lat, res.lng);
      bounds.extend(pos);
      hasBounds = true;

      const isCompleted = res.req.status === 'COMPLETED';
      const isInProgress = res.req.status === 'IN_PROGRESS';
      
      const originalIndex = requests.findIndex(r => r.id === res.req.id);
      let displayIndex: string | number = originalIndex !== -1 ? originalIndex + 1 : i + 1;
      let bgColor = '#FECACA'; 
      let textColor = '#991B1B'; 
      let borderStyle = '2px solid white';
      let zIndex = 1;

      // 순서 지정 모드일 경우 스타일 덮어쓰기
      if (isSettingOrder) {
         const orderPos = clickedOrder.indexOf(res.req.id);
         if (orderPos !== -1) {
           displayIndex = orderPos + 1;
           bgColor = '#3B82F6'; // 선택됨
           textColor = 'white';
           borderStyle = '3px solid #DBEAFE';
           zIndex = 20;
         } else {
           displayIndex = '?';
           bgColor = '#E5E7EB'; // 회색 (미선택)
           textColor = '#6B7280';
           zIndex = 5;
         }
      } else {
        if (isCompleted) {
          bgColor = '#22C55E'; textColor = 'white';
        } else if (isInProgress) {
          bgColor = '#3B82F6'; textColor = 'white'; borderStyle = '3px solid #DBEAFE'; zIndex = 10;
        }
      }

      const overlapIndex = res.overlapIndex || 0;
      const el = document.createElement('div');
      el.style.backgroundColor = bgColor;
      el.style.color = textColor;
      el.style.width = isSettingOrder && clickedOrder.includes(res.req.id) ? '36px' : '30px';
      el.style.height = isSettingOrder && clickedOrder.includes(res.req.id) ? '36px' : '30px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontWeight = 'bold';
      el.style.fontSize = isSettingOrder && clickedOrder.includes(res.req.id) ? '16px' : '14px';
      el.style.border = borderStyle;
      el.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
      el.style.cursor = isSettingOrder ? 'pointer' : 'default';
      el.style.zIndex = String(zIndex);
      el.innerText = String(displayIndex);
      
      // 겹침 방지 픽셀 이동 (줌 레벨과 무관하게 항상 일정 간격으로 펼쳐짐)
      if (overlapIndex > 0) {
        el.style.transform = `translateX(${overlapIndex * 36}px)`;
      }

      if (isSettingOrder) {
        // 호버 효과
        el.onmouseenter = () => { if(el.innerText === '?') el.style.backgroundColor = '#D1D5DB'; };
        el.onmouseleave = () => { if(el.innerText === '?') el.style.backgroundColor = bgColor; };
        // 클릭 이벤트
        el.onclick = () => {
          setClickedOrder(prev => {
            if (prev.includes(res.req.id)) {
              return prev.filter(id => id !== res.req.id);
            }
            return [...prev, res.req.id];
          });
        };
      }

      const markerOverlay = new kakao.maps.CustomOverlay({
        map: map,
        position: pos,
        content: el,
        yAnchor: 1,
        zIndex: zIndex
      });
      overlaysRef.current.push(markerOverlay);

      const labelHtml = `<div style="background-color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; border: 1px solid #ccc; transform: translate(${overlapIndex * 36}px, 15px); white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1); z-index: ${zIndex};">${res.req.userName}</div>`;
      const labelOverlay = new kakao.maps.CustomOverlay({
        map: map,
        position: pos,
        content: labelHtml,
        yAnchor: 0,
        zIndex: zIndex
      });
      overlaysRef.current.push(labelOverlay);
    });

    if (hasBounds) {
      map.setBounds(bounds);
      setTimeout(() => map.relayout(), 100);
    }
    
  }, [cachedCoords, isSettingOrder, clickedOrder, currentLat, currentLng, partnerAddress, partnerBusinessName]);

  const handleSaveClick = () => {
    // 선택되지 않은 나머지 항목들을 기존 순서대로 뒤에 붙입니다
    const unselectedIds = requests.map(r => r.id).filter(id => !clickedOrder.includes(id));
    const finalOrder = [...clickedOrder, ...unselectedIds];
    
    if (onSaveRouteOrder) {
      onSaveRouteOrder(finalOrder);
    }
    setIsSettingOrder(false);
    setClickedOrder([]);
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      
      {/* 순서 지정 모드 UI 헤더 */}
      {onSaveRouteOrder && (
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          {!isSettingOrder ? (
            <button 
              onClick={() => {
                setIsSettingOrder(true);
                setClickedOrder([]);
              }}
              className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
            >
              📍 지도에서 직접 순서 재지정
            </button>
          ) : (
            <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl flex flex-col gap-3 min-w-[200px]">
              <div className="text-sm font-bold text-gray-800 flex justify-between items-center">
                <span>클릭하여 순서 지정</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{clickedOrder.length}/{requests.length} 선택됨</span>
              </div>
              <p className="text-xs text-gray-500">지도의 회색 핀을 클릭하여 순서를 매겨주세요. 선택하지 않은 핀은 마지막 순서로 배정됩니다.</p>
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={() => {
                    setIsSettingOrder(false);
                    setClickedOrder([]);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 font-bold py-1.5 rounded-lg text-sm hover:bg-gray-200"
                >
                  취소
                </button>
                <button 
                  onClick={() => setClickedOrder([])}
                  className="bg-gray-100 text-gray-600 font-bold px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200"
                  title="선택 초기화"
                >
                  초기화
                </button>
                <button 
                  onClick={handleSaveClick}
                  className="flex-1 bg-green-500 text-white font-bold py-1.5 rounded-lg text-sm hover:bg-green-600"
                >
                  저장
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loadingCoords && (
        <div className="absolute inset-0 z-[15] bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-blue-700 font-bold animate-pulse">좌표 변환 중...</p>
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

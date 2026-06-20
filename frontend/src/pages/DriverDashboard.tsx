import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface RequestItem {
  id: string;
  userName: string;
  phone: string;
  address: string;
  detailAddress: string;
  estimatedVolume: string;
  status: string;
  etaMinutes?: number;
}

export default function DriverDashboard() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('driver_token'));

  useEffect(() => {
    if (authToken) {
      fetchDriverRequests();
    } else {
      setLoading(false);
    }
  }, [authToken]);

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role: 'DRIVER' });
      const token = res.data.token;
      localStorage.setItem('driver_token', token);
      setAuthToken(token);
    } catch (error) {
      alert('데모 로그인 실패: 기사 계정이 없습니다. 파트너 로그인을 먼저 진행해주세요.');
      setLoading(false);
    }
  };

  const fetchDriverRequests = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/driver/requests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setRequests(res.data.requests || []);
    } catch (error) {
      console.error('기사 배정 목록 조회 실패:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setAuthToken(null);
        localStorage.removeItem('driver_token');
      }
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const completeRequest = async (id: string) => {
    const confirm = window.confirm('수거 완료 처리하시겠습니까? (실제로는 여기서 사진 업로드 창이 뜹니다)');
    if (!confirm) return;

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/driver/complete/${id}`, {
        actualWeight: 15, // 임시 데이터
        driverNote: "수거 완료",
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('완료 처리되었습니다!');
      fetchDriverRequests();
    } catch (error) {
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const departRequest = async (id: string) => {
    if (!navigator.geolocation) {
      alert('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
      return;
    }
    
    const confirm = window.confirm('해당 수거지로 출발하시겠습니까? (고객에게 예상 도착 시간이 전송됩니다)');
    if (!confirm) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await axios.post(`${import.meta.env.VITE_API_URL}/driver/depart/${id}`, {
            currentLat: position.coords.latitude,
            currentLng: position.coords.longitude
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          const eta = res.data.request.etaMinutes;
          if (eta) {
            alert(`출발 처리 완료! (예상 소요 시간: ${eta}분)`);
          } else {
            alert('출발 처리 완료!');
          }
          fetchDriverRequests();
        } catch (error) {
          alert('출발 처리 중 오류가 발생했습니다.');
        }
      },
      (error) => {
        alert('위치 정보를 가져올 수 없습니다. 권한을 확인해주세요.');
      }
    );
  };

  const filteredRequests = requests.filter(r => 
    activeTab === 'pending' ? r.status !== 'COMPLETED' : r.status === 'COMPLETED'
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-white px-6 py-5 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">오늘의 수거 동선 🚚</h1>
          <p className="text-sm text-gray-500 mt-1">안전 운전하세요!</p>
        </div>
        {!authToken && (
          <button onClick={handleDemoLogin} className="px-4 py-2 bg-yellow-400 text-yellow-900 font-bold rounded-lg shadow-sm hover:bg-yellow-500 text-xs">
            기사 로그인 (데모)
          </button>
        )}
      </div>

      {/* Tab Bar (Top) */}
      <div className="flex bg-white border-b border-gray-200 sticky top-[76px] z-10">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
        >
          수거 대기
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'completed' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-400'}`}
        >
          수거 완료
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500">목록을 불러오는 중...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 font-medium">해당하는 수거 건이 없습니다.</p>
          </div>
        ) : (
          filteredRequests.map((req, idx) => (
            <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative">
              {activeTab === 'pending' && (
                <div className="absolute top-0 left-0 bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-br-2xl rounded-tl-2xl font-bold">
                  {idx + 1}
                </div>
              )}
              
              <div className="ml-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-900">{req.userName}</h3>
                  <a href={`tel:${req.phone}`} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold">
                    📞 전화걸기
                  </a>
                </div>
                {req.status === 'IN_PROGRESS' && (
                  <div className="mb-2 inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-200 shadow-sm">
                    🚚 이동 중 {req.etaMinutes ? `(도착 예상: ${req.etaMinutes}분)` : ''}
                  </div>
                )}
                <p className="text-gray-600 text-sm">{req.address}</p>
                <p className="text-gray-800 font-medium text-sm mt-1">{req.detailAddress}</p>
                <div className="mt-3 inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                  예상 무게: {req.estimatedVolume}
                </div>
              </div>

              {activeTab === 'pending' && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                      if (isMobile) {
                        window.location.href = `kakaomap://search?q=${encodeURIComponent(req.address)}`;
                      } else {
                        window.open(`https://map.kakao.com/link/search/${encodeURIComponent(req.address)}`, '_blank');
                      }
                    }}
                    className="py-3 bg-yellow-400 text-yellow-900 font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform"
                  >
                    카카오내비
                  </button>
                  {req.status === 'IN_PROGRESS' ? (
                    <button 
                      onClick={() => completeRequest(req.id)}
                      className="py-3 bg-blue-600 text-white font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform"
                    >
                      수거 완료하기
                    </button>
                  ) : (
                    <button 
                      onClick={() => departRequest(req.id)}
                      className="py-3 bg-green-600 text-white font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform"
                    >
                      출발하기
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom Mobile Tab Bar (Navigation) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col items-center text-blue-600">
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
          <span className="text-[10px] font-bold">동선</span>
        </div>
        <div className="flex flex-col items-center text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span className="text-[10px] font-bold">내 정보</span>
        </div>
      </div>
    </div>
  );
}

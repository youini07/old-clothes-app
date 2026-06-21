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
  partnerId: string | null;
  driverId: string | null;
  etaMinutes?: number;
  orderIndex?: number;
  actualWeight?: number;
  driverNote?: string | null;
  itemPhotoUrl?: string | null;
  scalePhotoUrl?: string | null;
  extraPhotoUrl?: string | null;
  completedDate?: string | Date | null;
  createdAt?: string | Date;
  displayId?: number;
}

interface Driver {
  id: string;
  user?: { name: string };
  name?: string; // Fallback
}

export default function AdminDashboard() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [activeView, setActiveView] = useState<'dispatch' | 'stats' | 'settings'>('dispatch');
  const [settings, setSettings] = useState<{ pricePerKg: number; useBizMessage: boolean } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });

  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', email: '', vehicleInfo: '' });

  // 모바일/클릭 배정용 상태
  const [selectedRequestIdForAssign, setSelectedRequestIdForAssign] = useState<string | null>(null);

  // 정산 통계
  const [stats, setStats] = useState<{ summary: any; monthlyStats: any[] } | null>(null);
  const [selectedCompletedRequest, setSelectedCompletedRequest] = useState<RequestItem | null>(null);

  const allCompletedRequests = requests
    .filter(r => r.status === 'COMPLETED')
    .sort((a, b) => {
      const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
      const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
      return dateB - dateA;
    });

  useEffect(() => {
    if (authToken) {
      fetchData();
      fetchStats();
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [authToken]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setStats(res.data);
    } catch (error) {
      console.error('통계 데이터 조회 실패:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/settings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSettings(res.data.settings);
    } catch (error) {
      console.error('환경 설정 조회 실패:', error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const res = await axios.patch(`${import.meta.env.VITE_API_URL}/admin/settings`, {
        pricePerKg: settings.pricePerKg,
        useBizMessage: settings.useBizMessage
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSettings(res.data.settings);
      alert('설정이 성공적으로 저장되었습니다.');
    } catch (error: any) {
      alert(error.response?.data?.error || '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role: 'PARTNER' });
      const token = res.data.token;
      localStorage.setItem('admin_token', token);
      setAuthToken(token);
    } catch (error) {
      alert('데모 로그인 실패');
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [reqsRes, driversRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/admin/requests`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/admin/drivers`, { headers })
      ]);
      setRequests(reqsRes.data.requests || []);
      setDrivers(driversRes.data.drivers || []);
    } catch (error) {
      console.error('데이터 조회 실패:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setAuthToken(null);
        localStorage.removeItem('admin_token');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) {
      return alert('새 비밀번호가 일치하지 않습니다.');
    }
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/auth/password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.');
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      localStorage.clear();
      window.location.href = '/login';
    } catch (error: any) {
      alert(error.response?.data?.error || '비밀번호 변경 실패');
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/admin/drivers`, driverForm, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert(res.data.message || '기사님이 성공적으로 등록되었습니다.');
      setIsDriverModalOpen(false);
      setDriverForm({ name: '', phone: '', email: '', vehicleInfo: '' });
      fetchData(); // 새 기사님 목록 불러오기
    } catch (error: any) {
      alert(error.response?.data?.error || '기사 등록 중 오류가 발생했습니다.');
    }
  };

  // 공통 기사 배정 함수 (드래그앤드롭 & 모바일 클릭 모두 사용)
  const assignDriver = async (requestId: string, targetDriverId: string | null) => {
    if (!authToken) return alert('로그인이 필요합니다.');

    // UI 즉시 업데이트 (Optimistic Update)
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return { ...req, driverId: targetDriverId, status: targetDriverId ? 'SCHEDULED' : 'ASSIGNED' };
      }
      return req;
    }));

    try {
      if (targetDriverId) {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/assign-driver`, {
          requestId,
          driverId: targetDriverId,
          confirmedDate: new Date()
        }, { headers: { Authorization: `Bearer ${authToken}` } });
      } else {
        // 배정 해제
        await axios.patch(`${import.meta.env.VITE_API_URL}/requests/${requestId}/assign`, {
          driverId: null
        }, { headers: { Authorization: `Bearer ${authToken}` } });
      }
    } catch (error) {
      console.error('배정 실패, 롤백');
      alert('기사 배정에 실패했습니다.');
      fetchData(); // 롤백
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, requestId: string) => {
    e.dataTransfer.setData('requestId', requestId);
  };

  const handleDrop = async (e: React.DragEvent, targetDriverId: string | null) => {
    e.preventDefault();
    const requestId = e.dataTransfer.getData('requestId');
    if (requestId) {
      await assignDriver(requestId, targetDriverId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // 드롭 허용
  };

  // 수락 대기 중인 요청 (아직 아무 사장님도 수락하지 않은 건)
  const pendingRequests = requests.filter(r => r.status === 'PENDING' && !r.partnerId);
  // 수락 완료 + 기사 미배정 건 (사장님이 수락했지만 기사 미배정)
  const acceptedUnassigned = requests.filter(r => r.partnerId && !r.driverId && r.status !== 'COMPLETED');
  // 기존 unassignedRequests는 기사 미배정 건 전체 (드래그 앤 드롭 대상)
  const unassignedRequests = acceptedUnassigned;

  // 수거 요청 수락 핸들러 (선착순)
  const handleClaim = async (requestId: string) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/${requestId}/claim`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('수거 요청을 수락했습니다! 기사를 배정해주세요.');
      fetchData(); // 목록 새로고침
    } catch (error: any) {
      const msg = error?.response?.data?.error || '수락에 실패했습니다.';
      alert(msg);
      fetchData();
    }
  };

  // 기사별 수거 동선 최적화 요청
  const handleOptimizeRoute = async (driverId: string) => {
    if (!authToken) return alert('로그인이 필요합니다.');

    // 팝업 차단 우회: 비동기 호출 전에 빈 창을 사용자 제스처 동기 범위 내에서 미리 생성
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 100px;">
          <h2>📍 최적 동선 계산 중...</h2>
          <p>카카오 경로 최적화 엔진을 통해 최단 경로를 계산하고 있습니다. 잠시만 기다려주세요.</p>
        </div>
      `);
    }

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/admin/drivers/${driverId}/optimize-route`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      fetchData(); // 최적화된 동선 순서(orderIndex)로 대시보드 리로드

      const origin = res.data.origin;
      const optimized = res.data.optimizedRequests;

      if (origin && optimized && optimized.length > 0) {
        // 네이버 지도는 경도(x), 위도(y) 순으로 경로 파라미터를 구성합니다.
        const startPath = `${origin.x},${origin.y},${encodeURIComponent("출발지(" + origin.address.split(" ")[1] + ")")}`;
        const pathSegments = [startPath];

        optimized.forEach((r: any) => {
          if (r.x && r.y) {
            pathSegments.push(`${r.x},${r.y},${encodeURIComponent(r.userName + "(" + r.address.split(" ")[1] + ")")}`);
          }
        });

        // 네이버 지도 다중 경유지 자동차 길찾기 URL 생성
        const naverMapUrl = `https://map.naver.com/v5/directions/${pathSegments.join('/')}/-/car`;
        
        if (newWindow) {
          newWindow.location.href = naverMapUrl;
        }
      } else {
        if (newWindow) newWindow.close();
        alert(res.data.message || '동선 최적화가 완료되었습니다.');
      }
    } catch (error: any) {
      if (newWindow) newWindow.close();
      alert(error.response?.data?.error || '동선 최적화 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="glass p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              지역 파트너 <span className="text-gradient">배차 대시보드</span>
            </h1>
            <p className="text-gray-500 mt-2 font-medium text-sm md:text-base">우리 지역에 접수된 수거 요청을 기사님들께 드래그 앤 드롭으로 배정하세요.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full md:flex md:w-auto md:gap-3">
            <button 
              onClick={() => {
                localStorage.removeItem('admin_token');
                window.location.href = '/login';
              }}
              className="flex items-center justify-center px-1.5 py-3 md:px-4 md:py-3 text-[10px] sm:text-xs md:text-sm text-gray-500 bg-gray-100 font-bold rounded-xl hover:bg-gray-200 transition-all whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 mr-0.5 sm:mr-1 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              로그아웃
            </button>
            {!authToken ? (
              <button onClick={handleDemoLogin} className="px-1.5 py-3 md:px-6 md:py-3 bg-yellow-400 text-yellow-900 font-bold rounded-xl shadow-md hover:bg-yellow-500 transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm text-center whitespace-nowrap">
                데모 로그인
              </button>
            ) : (
              <button 
                onClick={() => setIsPasswordModalOpen(true)}
                className="px-1.5 py-3 md:px-4 md:py-3 bg-gray-800 text-white font-bold rounded-xl shadow-md hover:bg-gray-900 transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm text-center whitespace-nowrap"
              >
                비밀번호 변경
              </button>
            )}
            <button 
              onClick={() => setIsDriverModalOpen(true)}
              className="px-1.5 py-3 md:px-6 md:py-3 bg-primary-600 text-white font-bold rounded-xl shadow-md hover:bg-primary-700 transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm text-center whitespace-nowrap"
            >
              기사님 추가
            </button>
          </div>
        </div>

        {/* 탭 전환 */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button onClick={() => setActiveView('dispatch')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'dispatch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>📋 배차 관리</button>
          <button onClick={() => setActiveView('stats')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'stats' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>📊 정산/통계</button>
          <button onClick={() => setActiveView('settings')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>⚙️ 환경 설정</button>
        </div>

        {/* 환경 설정 뷰 */}
        {activeView === 'settings' && settings && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">⚙️ 환경 설정</h2>
              <p className="text-gray-500 mb-8">수거 단가 및 카카오 알림톡 서비스 구독 여부를 설정할 수 있습니다.</p>

              <form onSubmit={handleSaveSettings} className="space-y-8">
                {/* 단가 설정 */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <label className="block text-lg font-bold text-gray-900">💰 1kg당 수거 단가 설정</label>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">기사님이 수거 완료 처리 시 고객에게 안내되는 정산 금액의 기준 단가입니다.</p>
                  
                  <div className="relative max-w-xs">
                    <input 
                      type="number" 
                      min="0"
                      step="10"
                      value={settings.pricePerKg} 
                      onChange={(e) => setSettings({...settings, pricePerKg: Number(e.target.value)})}
                      className="w-full text-right px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 font-bold text-xl text-primary-700"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold ml-2 pl-2 border-l border-gray-200">원</span>
                  </div>
                </div>

                {/* 알림톡 설정 */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-lg font-bold text-gray-900">💬 카카오 알림톡 자동 발송</label>
                    
                    {/* Toggle Button */}
                    <button 
                      type="button"
                      onClick={() => setSettings({...settings, useBizMessage: !settings.useBizMessage})}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${settings.useBizMessage ? 'bg-primary-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${settings.useBizMessage ? 'translate-x-8' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    활성화 시 배정, 일정 확정, 수거 완료(영수증) 단계마다 <strong>고객의 개인 카카오톡</strong>으로 공식 알림톡이 자동 발송됩니다.
                  </p>
                  
                  {settings.useBizMessage ? (
                    <div className="bg-primary-50 text-primary-800 p-4 rounded-xl text-sm font-medium border border-primary-100 flex gap-3 items-start">
                      <span className="text-xl">✅</span>
                      <div>
                        <strong>현재 알림톡 발송 기능이 활성화되어 있습니다.</strong><br/>
                        수거 단계마다 자동으로 시스템 알림이 전송됩니다.
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-100 text-gray-600 p-4 rounded-xl text-sm font-medium flex gap-3 items-start">
                      <span className="text-xl">⏸️</span>
                      <div>
                        <strong>알림톡 발송 기능이 꺼져 있습니다.</strong><br/>
                        고객에게 수거 안내 카카오톡이 발송되지 않습니다.
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSavingSettings}
                    className="px-8 py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    {isSavingSettings ? '저장 중...' : '변경사항 저장하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 정산/통계 뷰 */}
        {activeView === 'stats' && stats && (
          <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">총 수거 건수</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.summary.totalRequests}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">완료 건수</p>
                <p className="text-3xl font-extrabold text-green-600 mt-1">{stats.summary.completedCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">총 수거 무게</p>
                <p className="text-3xl font-extrabold text-blue-600 mt-1">{stats.summary.totalWeight}<span className="text-lg">kg</span></p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">완료율</p>
                <p className="text-3xl font-extrabold text-purple-600 mt-1">{stats.summary.completionRate}<span className="text-lg">%</span></p>
              </div>
            </div>

            {/* 현재 상태 현황 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📍 현재 진행 상황</h3>
              <div className="flex gap-4">
                <div className="flex-1 bg-yellow-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-yellow-600">{stats.summary.pendingCount}</p>
                  <p className="text-xs text-yellow-700 font-medium mt-1">대기 중</p>
                </div>
                <div className="flex-1 bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-blue-600">{stats.summary.inProgressCount}</p>
                  <p className="text-xs text-blue-700 font-medium mt-1">진행 중</p>
                </div>
                <div className="flex-1 bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-green-600">{stats.summary.completedCount}</p>
                  <p className="text-xs text-green-700 font-medium mt-1">완료</p>
                </div>
              </div>
            </div>

            {/* 월별 수거량 차트 (CSS 바 차트) */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📈 월별 수거 현황 (최근 6개월)</h3>
              <div className="space-y-3">
                {stats.monthlyStats.map((m: any) => {
                  const maxCount = Math.max(...stats.monthlyStats.map((s: any) => s.count), 1);
                  const barWidth = (m.count / maxCount) * 100;
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500 w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 flex items-center" style={{ width: `${Math.max(barWidth, 2)}%` }}>
                          {m.count > 0 && <span className="text-[10px] font-bold text-white ml-2 whitespace-nowrap">{m.count}건 / {m.weight}kg</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 완료된 수거 증빙 확인 섹션 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📸 완료된 수거 증빙 확인</h3>
              {allCompletedRequests.length === 0 ? (
                <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                  완료된 수거 건이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allCompletedRequests.map(req => {
                    const driverObj = drivers.find(d => d.id === req.driverId);
                    const driverName = driverObj?.user?.name || driverObj?.name || '미지정';
                    return (
                      <div 
                        key={req.id}
                        onClick={() => setSelectedCompletedRequest(req)}
                        className="p-4 bg-gray-50 hover:bg-primary-50/50 border border-gray-100 hover:border-primary-300 rounded-2xl shadow-sm cursor-pointer transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-gray-900 text-base">{req.userName} <span className="text-xs font-normal text-gray-500">{req.phone}</span></h4>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{req.address} {req.detailAddress}</p>
                          </div>
                          <span className="text-xs bg-green-50 text-green-700 font-bold px-2.5 py-1 rounded-lg shrink-0">
                            {req.actualWeight}kg
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-200/50">
                          <span>담당 기사: <strong className="text-gray-700">{driverName}</strong></span>
                          <span>{req.completedDate ? new Date(req.completedDate).toLocaleDateString('ko-KR') : ''}</span>
                        </div>
                        <div className="flex items-center justify-center py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-primary-600 hover:bg-primary-50 transition-colors">
                          📸 완료 증빙 사진 및 내역 보기
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 배차 관리 뷰 */}
        {activeView === 'dispatch' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: 수거 요청 (수락 대기 + 기사 미배정) */}
          <div 
            className="lg:col-span-1 glass-dark rounded-3xl p-6 min-h-[500px] border-gray-200 bg-white shadow-sm"
            onDrop={(e) => handleDrop(e, null)}
            onDragOver={handleDragOver}
          >
            {/* 수락 대기 섹션 */}
            {pendingRequests.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-orange-600">🔔 신규 수거 요청</h2>
                  <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold animate-pulse">{pendingRequests.length}건</span>
                </div>
                <div className="space-y-4">
                  {pendingRequests.map(req => (
                    <div 
                      key={req.id} 
                      className="p-5 bg-orange-50 border-2 border-orange-200 rounded-2xl shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900">{req.userName} <span className="text-sm font-normal text-gray-500">{req.phone}</span></h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{req.address} {req.detailAddress}</p>
                      <div className="flex justify-between items-center mt-3">
                        <span className="inline-block bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs font-bold">
                          {req.estimatedVolume}
                        </span>
                        <button
                          onClick={() => handleClaim(req.id)}
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          ✋ 수락하기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 기사 미배정 섹션 (수락 완료, 기사 배정 필요) */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">기사 미배정</h2>
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">{unassignedRequests.length}건</span>
            </div>
            
            {loading ? (
              <div className="text-center py-10 text-gray-400">로딩 중...</div>
            ) : unassignedRequests.length === 0 ? (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                {pendingRequests.length === 0 ? '수거 요청이 없습니다.' : '수락한 건을 기사에게 배정해주세요.'}
              </div>
            ) : (
              <div className="space-y-4">
                {unassignedRequests.map(req => (
                  <div 
                    key={req.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, req.id)}
                    onClick={() => setSelectedRequestIdForAssign(req.id)}
                    className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm cursor-pointer lg:cursor-grab active:cursor-grabbing hover:border-primary-400 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900">{req.userName} <span className="text-sm font-normal text-gray-500">{req.phone}</span></h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{req.address} {req.detailAddress}</p>
                    <div className="mt-3 inline-block bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs font-bold">
                      {req.estimatedVolume}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Drivers */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {drivers.map(driver => {
              const rawDriverRequests = requests.filter(r => r.driverId === driver.id);
              // createdAt(접수시간) 오름차순으로 고유 순번(displayId) 부여
              const driverRequestsWithId = [...rawDriverRequests].sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (timeA === timeB) return a.id.localeCompare(b.id);
                return timeA - timeB;
              }).map((req, index) => ({ ...req, displayId: index + 1 }));

              // 화면 표시를 위해 배차 순서(orderIndex)로 재정렬
              const allDriverRequests = [...driverRequestsWithId].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

              const driverRequests = allDriverRequests.filter(r => r.status !== 'COMPLETED');
              const completedRequests = allDriverRequests.filter(r => r.status === 'COMPLETED');

              return (
                <div 
                  key={driver.id} 
                  className="bg-primary-50/50 border-2 border-primary-100 rounded-3xl p-6 min-h-[500px] flex flex-col"
                  onDrop={(e) => handleDrop(e, driver.id)}
                  onDragOver={handleDragOver}
                >
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-primary-200">
                    <h2 className="text-xl font-bold text-primary-900">🚚 {driver.user?.name || driver.name}</h2>
                    <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-bold">{driverRequests.length}건 대기중</span>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    {driverRequests.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-primary-400 font-medium pb-10">
                        여기로 카드를 드래그하여 배정하세요
                      </div>
                    ) : (
                      driverRequests.map((req) => (
                        <div 
                          key={req.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, req.id)}
                          className={`p-4 bg-white border rounded-2xl shadow-sm cursor-grab active:cursor-grabbing transition-all flex gap-3 ${req.status === 'IN_PROGRESS' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-primary-100 hover:border-primary-400'}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${req.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-primary-100 text-primary-800'}`}>
                            {req.displayId}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h3 className="font-bold text-gray-900 text-sm">{req.userName}</h3>
                              {req.status === 'IN_PROGRESS' && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full animate-pulse">
                                  이동 중 {req.etaMinutes ? `(${req.etaMinutes}분)` : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{req.address}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Completed Items Section */}
                  {completedRequests.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-primary-200/50">
                      <h3 className="text-sm font-bold text-gray-600 mb-3">✅ 완료된 수거 ({completedRequests.length}건)</h3>
                      <div className="space-y-2 opacity-70">
                        {completedRequests.map(req => (
                          <div 
                            key={req.id} 
                            onClick={() => setSelectedCompletedRequest(req)}
                            className="p-3 bg-white border border-gray-100 hover:border-primary-400 hover:shadow-sm rounded-2xl flex justify-between items-center cursor-pointer transition-all"
                          >
                            <div className="min-w-0 flex-1 mr-2">
                              <p className="text-xs font-bold text-gray-800">{req.userName} <span className="font-normal text-gray-500">님</span></p>
                              <p className="text-[10px] text-gray-500 truncate w-full">{req.address}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">
                                {req.actualWeight}kg
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">증빙 보기</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleOptimizeRoute(driver.id)}
                    className="w-full mt-6 py-3 bg-white border-2 border-primary-600 text-primary-600 font-bold rounded-xl hover:bg-primary-50 transition-colors"
                  >
                    최적 동선 카카오내비 전송
                  </button>
                </div>
              );
            })}
          </div>

        </div>}
      </div>

      {/* 비밀번호 변경 모달 */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">비밀번호 변경</h2>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">현재 비밀번호</label>
                <input required type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="기존 비밀번호 입력" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">새 비밀번호</label>
                <input required type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="새로운 비밀번호" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">새 비밀번호 확인</label>
                <input required type="password" value={passwordForm.newPasswordConfirm} onChange={e => setPasswordForm({...passwordForm, newPasswordConfirm: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="비밀번호 재입력" />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  변경 저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 기사님 추가 모달 */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsDriverModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">기사님 등록</h2>
            <p className="text-sm text-gray-500 mb-6">등록된 기사님의 초기 비밀번호는 입력하신 연락처로 설정됩니다.</p>
            
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">기사님 성함</label>
                <input required type="text" value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">이메일 (ID 겸용)</label>
                <input required type="email" value={driverForm.email} onChange={e => setDriverForm({...driverForm, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="driver@test.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">연락처</label>
                <input required type="tel" value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="010-1234-5678" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">차량 정보 (선택)</label>
                <input type="text" value={driverForm.vehicleInfo} onChange={e => setDriverForm({...driverForm, vehicleInfo: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="1톤 트럭 (서울12가 3456)" />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="w-full py-4 bg-primary-600 text-white font-bold rounded-xl shadow-lg hover:bg-primary-700 transition-colors"
                >
                  등록 완료하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        {/* 모바일 기사 배정 모달 */}
        {selectedRequestIdForAssign && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">어느 기사님에게 배정할까요?</h3>
              
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {drivers.map(driver => (
                  <button
                    key={driver.id}
                    onClick={() => {
                      assignDriver(selectedRequestIdForAssign, driver.id);
                      setSelectedRequestIdForAssign(null);
                    }}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-primary-50 rounded-2xl border border-gray-100 hover:border-primary-200 transition-all"
                  >
                    <div className="font-bold text-gray-900 text-lg">
                      {driver.user?.name || driver.name} 기사님
                    </div>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setSelectedRequestIdForAssign(null)}
                className="mt-6 w-full py-4 text-gray-500 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                취소
              </button>
            </div>
          </div>
        )}

      {/* 수거 완료 상세 증빙 모달 */}
      {selectedCompletedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedCompletedRequest(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">📸 수거 완료 증빙 상세</h2>
            <p className="text-sm text-gray-500 mb-6">기사님이 현장에서 수거 시 등록한 실제 무게 및 증빙 사진 정보입니다.</p>

            <div className="space-y-5">
              {/* 정보 표 */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">고객명</span><span className="font-bold text-gray-900">{selectedCompletedRequest.userName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">연락처</span><span className="font-bold text-gray-900">{selectedCompletedRequest.phone}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">수거 주소</span><span className="font-bold text-gray-900 text-right max-w-[250px] break-all">{selectedCompletedRequest.address} {selectedCompletedRequest.detailAddress}</span></div>
                <div className="flex justify-between text-sm border-t border-gray-200/50 pt-2"><span className="text-gray-500">실제 무게</span><span className="font-extrabold text-primary-600 text-lg">{selectedCompletedRequest.actualWeight} kg</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">수거 완료일시</span><span className="font-semibold text-gray-800">{selectedCompletedRequest.completedDate ? new Date(selectedCompletedRequest.completedDate).toLocaleString('ko-KR') : '-'}</span></div>
                <div className="flex flex-col text-sm border-t border-gray-200/50 pt-2"><span className="text-gray-500">기사 메모</span><p className="font-medium text-gray-900 mt-1 bg-white p-3 rounded-lg border border-gray-100">{selectedCompletedRequest.driverNote || '특이사항 없음'}</p></div>
              </div>

              {/* 사진 리스트 */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">📍 첨부 증빙 사진</h3>
                <div className="grid grid-cols-3 gap-3">
                  {/* 1단계 물품 사진 */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-full h-24 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                      {selectedCompletedRequest.itemPhotoUrl ? (
                        <img src={selectedCompletedRequest.itemPhotoUrl} alt="물품 사진" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">미첨부</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-semibold">1단계: 물품</span>
                  </div>

                  {/* 2단계 저울 사진 */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-full h-24 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                      {selectedCompletedRequest.scalePhotoUrl ? (
                        <img src={selectedCompletedRequest.scalePhotoUrl} alt="저울 사진" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">미첨부</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-semibold">2단계: 저울</span>
                  </div>

                  {/* 3단계 특이사항 사진 */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-full h-24 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                      {selectedCompletedRequest.extraPhotoUrl ? (
                        <img src={selectedCompletedRequest.extraPhotoUrl} alt="특이사항 사진" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">미첨부</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-semibold">3단계: 추가</span>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedCompletedRequest(null)}
              className="mt-6 w-full py-4 text-white font-bold bg-primary-600 rounded-xl hover:bg-primary-700 transition-all shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

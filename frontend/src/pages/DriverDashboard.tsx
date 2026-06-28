import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DriverMap from '../components/DriverMap';
import Spinner from '../components/Spinner';
import { Camera, X } from 'lucide-react';

interface RequestItem {
  id: string;
  userName: string;
  phone: string;
  address: string;
  detailAddress: string;
  estimatedVolume: string;
  status: string;
  etaMinutes?: number;
  actualWeight?: number;
  totalPrice?: number;
  customerPackedPhotoUrl?: string | null;
  isMustPickupDate?: boolean;
  createdAt?: string | Date;
}

const DriverProfileForm = ({ authToken }: { authToken: string }) => {
  const [profile, setProfile] = useState({ name: '', phone: '', vehicleInfo: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);



  async function fetchProfile() {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/driver/me`, { headers: { Authorization: `Bearer ${authToken}` } });
      setProfile({
        name: res.data.name || '',
        phone: res.data.phone || '',
        vehicleInfo: res.data.vehicleInfo || '',
      });
    } catch { alert('프로필을 불러올 수 없습니다.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/driver/me`, profile, { headers: { Authorization: `Bearer ${authToken}` } });
      alert('프로필이 성공적으로 업데이트되었습니다.');
    } catch { alert('프로필 수정 중 오류가 발생했습니다.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-10 text-gray-500">불러오는 중...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">내 정보 수정</h2>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">이름</label>
        <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium" />
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">핸드폰 번호 (고객에게 발송됩니다)</label>
        <input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="010-0000-0000" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium" />
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">차량 정보</label>
        <input type="text" value={profile.vehicleInfo} onChange={e => setProfile({ ...profile, vehicleInfo: e.target.value })} placeholder="예: 1톤 탑차 (12가 3456)" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium" />
      </div>
      <button onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-bold rounded-xl mt-4 active:scale-95 transition-transform shadow-md disabled:opacity-50">
        {saving && <Spinner className="w-5 h-5 text-white" />}
        {saving ? '저장 중...' : '저장하기'}
      </button>
    </div>
  );
};

const PhotoUpload = ({ photo, setter, label, color, handlePhotoChange }: { photo: string | null; setter: (v: string | null) => void; label: string; color: string; handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string | null) => void) => void }) => (
  photo ? (
    <div className="relative">
      <img src={photo} alt="Upload" className="w-full h-48 object-cover rounded-xl" />
      <button type="button" onClick={() => setter(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
        <X size={20} />
      </button>
    </div>
  ) : (
    <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-${color}-300 rounded-xl bg-${color}-50 hover:bg-${color}-100 cursor-pointer transition-colors`}>
      <Camera size={32} className={`text-${color}-500 mb-2`} />
      <span className={`text-sm font-bold text-${color}-700`}>{label}</span>
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoChange(e, setter)} />
    </label>
  )
);

export default function DriverDashboard() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [activeMainTab, setActiveMainTab] = useState<'route' | 'profile'>('route');
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('driver_token') || localStorage.getItem('admin_token'));
  const [showMap, setShowMap] = useState(false);

  // 고객 포장 사진 뷰어 상태
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // 파트너(사장님) 정보 상태
  const [partnerAddress, setPartnerAddress] = useState<string>('');
  const [partnerBusinessName, setPartnerBusinessName] = useState<string>('');

  // 문자 템플릿 모달 상태
  const [selectedSmsReq, setSelectedSmsReq] = useState<{req: RequestItem, displayId: number} | null>(null);

  // 수거 완료 모달 상태
  const [completeModal, setCompleteModal] = useState<{ open: boolean; requestId: string | null; step: number }>({ open: false, requestId: null, step: 1 });
  const [actualWeight, setActualWeight] = useState('');
  const [driverNote, setDriverNote] = useState('');
  const [itemPhoto, setItemPhoto] = useState<string | null>(null);
  const [scalePhoto, setScalePhoto] = useState<string | null>(null);
  const [extraPhoto, setExtraPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);



  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role: 'DRIVER' });
      localStorage.setItem('driver_token', res.data.token);
      setAuthToken(res.data.token);
    } catch { alert('데모 로그인 실패'); setLoading(false); }
  };

  async function fetchDriverRequests(currentPage = page) {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/driver/requests?page=${currentPage}&limit=50`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setRequests(res.data.requests || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setAuthToken(null); localStorage.removeItem('driver_token');
      }
      setRequests([]);
    } finally { setLoading(false); }
  };

  async function fetchDriverInfo() {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/driver/me`, { headers: { Authorization: `Bearer ${authToken}` } });
      setPartnerAddress(res.data.partnerAddress || '');
      setPartnerBusinessName(res.data.partnerBusinessName || '');
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (authToken) { 
      fetchDriverRequests(page); 
      fetchDriverInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, page]);

  const [optimizing, setOptimizing] = useState(false);
  const [returnToStart, setReturnToStart] = useState(true);
  const [returnAddress, setReturnAddress] = useState('');
  
  const [isLargeText, setIsLargeText] = useState(() => localStorage.getItem('driver_isLargeText') === 'true');

  useEffect(() => {
    localStorage.setItem('driver_isLargeText', isLargeText.toString());
  }, [isLargeText]);

  const handleOptimizeRoute = () => {
    if (returnToStart && !returnAddress.trim()) {
      alert('경로 종착지를 설정하셨다면 도착할 주소를 직접 입력하시거나 회사 주소를 선택해주세요.');
      return;
    }

    if (!navigator.geolocation) {
      alert('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
      return;
    }

    setOptimizing(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/driver/optimize-route`,
            { currentLat: latitude, currentLng: longitude, returnToStart, returnAddress },
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          alert(res.data.message);
          fetchDriverRequests(); // 순서 갱신을 위해 목록 다시 불러오기
        } catch (error) {
          console.error(error);
          alert('동선 최적화 중 오류가 발생했습니다.');
        } finally {
          setOptimizing(false);
        }
      },
      (error) => {
        console.error('위치 정보 에러:', error);
        alert('현재 위치를 가져올 수 없습니다. GPS 권한을 확인해주세요.');
        setOptimizing(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 이미지 압축 (Canvas를 활용해 1024px 해상도 제한 및 JPEG 70% 품질 압축)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 1024; // 최대 크기 제한
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% 품질로 압축
            resolve(dataUrl);
          } else {
            reject(new Error('Canvas context is null'));
          }
        };
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsDataURL(file);
    });
  };

  // 사진 입력 처리 및 압축 연동
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressedBase64 = await compressImage(file);
      setter(compressedBase64);
    } catch (error) {
      console.error('이미지 압축 실패:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  const openCompleteModal = (id: string) => {
    setCompleteModal({ open: true, requestId: id, step: 1 });
    setActualWeight(''); setDriverNote(''); setItemPhoto(null); setScalePhoto(null); setExtraPhoto(null);
  };

  const closeModal = () => setCompleteModal({ open: false, requestId: null, step: 1 });

  const submitComplete = async () => {
    if (!completeModal.requestId || !actualWeight) { alert('실제 수거 무게를 입력해주세요.'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/driver/complete/${completeModal.requestId}`, {
        actualWeight: parseFloat(actualWeight),
        driverNote: driverNote || '수거 완료',
        itemPhotoUrl: itemPhoto || undefined,
        scalePhotoUrl: scalePhoto || undefined,
        extraPhotoUrl: extraPhoto || undefined,
      }, { headers: { Authorization: `Bearer ${authToken}` } });
      alert('수거 완료 처리되었습니다!');
      closeModal();
      fetchDriverRequests();
    } catch { alert('처리 중 오류가 발생했습니다.'); }
    finally { setSubmitting(false); }
  };

  const departRequest = async (id: string) => {
    if (!navigator.geolocation) { alert('위치 정보를 지원하지 않는 브라우저입니다.'); return; }
    if (!window.confirm('해당 수거지로 출발하시겠습니까?')) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/driver/depart/${id}`, {
          currentLat: pos.coords.latitude, currentLng: pos.coords.longitude
        }, { headers: { Authorization: `Bearer ${authToken}` } });
        const eta = res.data.request.etaMinutes;
        alert(eta ? `출발 완료! (예상 ${eta}분)` : '출발 완료!');
        fetchDriverRequests();
      } catch { alert('출발 처리 중 오류가 발생했습니다.'); }
    }, () => alert('위치 정보를 가져올 수 없습니다.'));
  };

  // 모바일 기기별 네비게이션 앱 강제 실행 핸들러 (T맵)
  const handleNaviClick = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

    if (isAndroid) {
      // Android: T맵 인텐트 호출
      const fallbackUrl = `https://play.google.com/store/apps/details?id=com.skt.tmap.ku`;
      const intentUrl = `intent://search?name=${encodedAddress}#Intent;scheme=tmap;package=com.skt.tmap.ku;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`;
      window.location.assign(intentUrl);
    } else if (isIOS) {
      // iOS: T맵 스킴 호출
      window.location.assign(`tmap://search?name=${encodedAddress}`);
      // 앱이 없는 경우 앱스토어로 유도
      setTimeout(() => {
        window.open(`https://apps.apple.com/kr/app/id431589174`, '_blank');
      }, 1500);
    } else {
      // PC 환경 등에서는 안전하게 네이버/카카오 웹 지도를 띄우거나 안내 메시지
      alert('T맵 길안내는 모바일 기기에서만 지원됩니다.');
    }
  };

  // 기사앱 원본 리스트(백엔드에서는 orderIndex -> createdAt 순으로 정렬되어 넘어옴)
  // 배열의 전체 순서(index)가 곧 사용자의 고정된 순번이 되므로, 완료되어도 번호가 바뀌지 않음
  const requestsWithDisplayId = React.useMemo(() => {
    return requests.map((req, index) => ({ ...req, displayId: index + 1 }));
  }, [requests]);

  const filteredRequests = requestsWithDisplayId.filter(r =>
    activeTab === 'pending' ? r.status !== 'COMPLETED' : r.status === 'COMPLETED'
  );

  const getSmsTemplate1 = (displayId: number) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = tomorrow.getDate();
    return `안녕하세요! 올클입니다.\n\n내일(${day}일) 헌옷 수거 방문 예정입니다.\n고객님의 수거 순번은 [${displayId}번째] 입니다.\n\n수거할 옷과 물품들은 미리 포장하여 문 앞에 내놓아 주시면 감사하겠습니다!`;
  };

  const getSmsTemplate2 = () => {
    return `안녕하세요! 올클입니다.\n\n지금 고객님 댁으로 수거하러 출발합니다!\n곧 도착할 예정이오니 잠시만 기다려주세요.\n감사합니다.`;
  };

  const getSmsTemplate3 = (req: RequestItem) => {
    const weight = req.actualWeight || 0;
    const price = req.totalPrice || 0;
    return `안녕하세요! 올클입니다.\n\n고객님의 헌옷 수거가 완료되었습니다!\n- 수거 무게: ${weight}kg\n- 정산 금액: ${price.toLocaleString()}원\n\n저희 올클을 이용해 주셔서 진심으로 감사드립니다.\n앞으로도 많은 이용 부탁드립니다!`;
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-20 custom-scrollbar print:hidden">
      {isLargeText && (
        <style>{`
          html { font-size: 19px !important; }
        `}</style>
      )}
      
      {/* Header */}
      <div className="bg-white px-4 md:px-6 py-4 shadow-sm sticky top-0 z-20 flex flex-wrap justify-between items-center gap-y-3 gap-x-2">
        <div className="shrink-0 mr-2">
          <h1 className="text-xl font-extrabold text-gray-900">{'오늘의 수거 동선 🚚'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">안전 운전하세요!</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isLargeText ? (
            <button onClick={() => setIsLargeText(false)} className="px-2.5 py-2 bg-gray-200 text-gray-800 font-bold rounded-xl text-xs hover:bg-gray-300 transition-colors whitespace-nowrap flex-shrink-0">
              🔍 기본
            </button>
          ) : (
            <button onClick={() => setIsLargeText(true)} className="px-2.5 py-2 bg-blue-100 text-blue-700 font-bold rounded-xl text-xs hover:bg-blue-200 transition-colors whitespace-nowrap flex-shrink-0">
              🔍 크게
            </button>
          )}
          <button onClick={() => window.print()} className="px-2.5 py-2 bg-purple-100 text-purple-700 font-bold rounded-xl text-xs hover:bg-purple-200 transition-colors whitespace-nowrap flex-shrink-0 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            인쇄
          </button>
          {localStorage.getItem('admin_token') && (
            <div className="flex bg-gray-100/80 p-1 rounded-xl shadow-inner relative w-32 border border-gray-200 backdrop-blur-sm shrink-0">
              <div className="absolute left-1 top-1 w-[calc(50%-4px)] bottom-1 bg-white rounded-lg shadow-[0_2px_8px_rgb(0,0,0,0.08)] transition-transform duration-300 translate-x-0"></div>
              <button 
                className="flex-1 py-1.5 text-[10px] font-extrabold z-10 text-blue-600 transition-colors cursor-default"
              >
                🚚 기사
              </button>
              <button 
                onClick={() => window.location.href = '/admin'} 
                className="flex-1 py-1.5 text-[10px] font-bold z-10 text-gray-500 hover:text-gray-700 transition-colors"
              >
                🏢 사장
              </button>
            </div>
          )}
          {!authToken && <button onClick={handleDemoLogin} className="px-3 py-2 bg-yellow-400 text-yellow-900 font-bold rounded-lg shadow-sm hover:bg-yellow-500 text-xs whitespace-nowrap flex-shrink-0">데모 로그인</button>}
          <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} className="flex items-center justify-center w-8 h-8 text-gray-500 bg-gray-100 font-bold rounded-lg hover:bg-gray-200 transition-all flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>
      </div>

      {activeMainTab === 'route' ? (
        <>
          {/* 현위치 기반 최적화 버튼 */}
          <div className="px-4 py-3 bg-white space-y-3">
            <div className={`p-4 rounded-2xl flex flex-col gap-3 transition-all ${returnToStart ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={returnToStart} onChange={e => setReturnToStart(e.target.checked)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 accent-blue-600 cursor-pointer" />
                <span className="font-extrabold text-gray-800 text-sm">📍 경로 종착지 설정</span>
              </label>
              {returnToStart && (
                <div className="pl-8">
                  <label className="block text-xs font-bold text-gray-500 mb-1">도착할 목적지 주소 (입력 또는 회사 선택)</label>
                  <input type="text" value={returnAddress} onChange={e => setReturnAddress(e.target.value)} placeholder="직접 주소 입력 또는 아래 버튼으로 회사 선택" className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all mb-2" />
                  {partnerAddress && (
                    <button 
                      onClick={() => setReturnAddress(partnerAddress)}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-200 transition-colors"
                    >
                      🏢 {partnerBusinessName || '회사'} 주소로 간편 등록
                    </button>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={handleOptimizeRoute}
              disabled={optimizing}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 transition-all"
            >
              {optimizing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  최적화 진행 중...
                </>
              ) : '📍 현위치 기반 최적 동선 짜기'}
            </button>
            <button 
              onClick={() => setShowMap(!showMap)}
              className="w-full bg-teal-50 text-teal-700 border border-teal-200 font-bold py-3 rounded-xl shadow-sm hover:bg-teal-100 flex items-center justify-center gap-2 transition-all"
            >
              🗺️ {showMap ? '지도 숨기기' : '전체 수거지 지도에서 보기'}
            </button>
            {showMap && (
              <div className="mt-2">
                <DriverMap requests={filteredRequests} partnerAddress={partnerAddress} partnerBusinessName={partnerBusinessName} />
              </div>
            )}
          </div>

          {/* Tab Bar */}
          <div className="flex bg-white border-b border-gray-200 sticky top-[88px] z-10">
            <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>수거 대기</button>
            <button onClick={() => setActiveTab('completed')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'completed' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-400'}`}>수거 완료</button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="text-center py-10 text-gray-500">목록을 불러오는 중...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl shadow-sm">
                <div className="text-4xl mb-3">{'📭'}</div>
                <p className="text-gray-500 font-medium">해당하는 수거 건이 없습니다.</p>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div key={req.id} className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 relative mb-4">
                  {activeTab === 'pending' && <div className="absolute top-0 left-0 bg-blue-600 text-white w-9 h-9 flex items-center justify-center rounded-br-2xl rounded-tl-3xl font-extrabold">{req.displayId}</div>}
                  <div className="ml-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        {req.userName}
                        {req.isMustPickupDate && (
                          <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                            🚨 필수 수거
                          </span>
                        )}
                      </h3>
                      <div className="flex gap-2">
                        <a href={`tel:${req.phone}`} className="px-3.5 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-bold transition-colors hover:bg-green-100">{'📞 전화'}</a>
                        <button onClick={() => setSelectedSmsReq({req, displayId: req.displayId})} className="px-3.5 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold transition-colors hover:bg-blue-100">{'💬 문자'}</button>
                      </div>
                    </div>
                    {req.status === 'IN_PROGRESS' && (
                      <div className="mb-2 inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-200 shadow-sm">
                        {'🚚 이동 중'} {req.etaMinutes ? `(도착 예상: ${req.etaMinutes}분)` : ''}
                      </div>
                    )}
                    <p className="text-gray-600 text-sm">{req.address}</p>
                    <p className="text-gray-800 font-medium text-sm mt-1">{req.detailAddress}</p>
                    <div className="mt-3 inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-semibold">예상 무게: {req.estimatedVolume}</div>
                    {req.status === 'COMPLETED' && req.actualWeight && (
                      <div className="mt-2 inline-block ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">실제: {req.actualWeight}kg</div>
                    )}
                  </div>
                  {req.customerPackedPhotoUrl && (
                    <div className="mt-3 ml-6">
                      <button 
                        onClick={() => setViewingPhoto(req.customerPackedPhotoUrl || null)}
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        고객 포장 사진 확인
                      </button>
                    </div>
                  )}
                  {activeTab === 'pending' && (
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleNaviClick(req.address)} 
                        className="py-3.5 bg-teal-500 text-white font-extrabold rounded-2xl text-sm shadow-md active:scale-95 transition-transform"
                      >
                        T맵 안내
                      </button>
                      {req.status === 'IN_PROGRESS' ? (
                        <button onClick={() => openCompleteModal(req.id)} className="py-3.5 bg-blue-600 text-white font-extrabold rounded-2xl text-sm shadow-md active:scale-95 transition-transform">{'📸 수거 완료하기'}</button>
                      ) : (
                        <button onClick={() => departRequest(req.id)} className="py-3.5 bg-green-600 text-white font-extrabold rounded-2xl text-sm shadow-md active:scale-95 transition-transform">출발하기</button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Pagination UI */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 pb-12">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 disabled:opacity-50 font-bold hover:bg-gray-50 transition-colors"
                >
                  이전
                </button>
                <span className="px-4 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-xl">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 disabled:opacity-50 font-bold hover:bg-gray-50 transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-4">
          {authToken ? <DriverProfileForm authToken={authToken} /> : <div className="text-center py-10">로그인이 필요합니다.</div>}
        </div>
      )}

      {/* 수거 완료 3단계 모달 */}
      {completeModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button type="button" onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold">X</button>
            {/* 단계 인디케이터 */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-3 h-3 rounded-full transition-all ${completeModal.step >= s ? 'bg-blue-600 scale-110' : 'bg-gray-200'}`} />
              ))}
            </div>

            {/* Step 1: 물품 사진 */}
            {completeModal.step === 1 && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">{'📦'}</div>
                  <h3 className="text-lg font-bold text-gray-900">1단계: 수거 물품 촬영</h3>
                  <p className="text-sm text-gray-500 mt-1">수거할 물품의 전체 사진을 찍어주세요.</p>
                </div>
                <PhotoUpload photo={itemPhoto} setter={setItemPhoto} label="탭하여 사진 촬영/선택" color="blue" handlePhotoChange={handlePhotoChange} />
                <button type="button" onClick={() => setCompleteModal(m => ({ ...m, step: 2 }))} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-transform">
                  {itemPhoto ? '다음 단계' : '건너뛰기'}  {'>'}
                </button>
              </div>
            )}

            {/* Step 2: 저울 사진 + 무게 입력 */}
            {completeModal.step === 2 && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">{'⚖️'}</div>
                  <h3 className="text-lg font-bold text-gray-900">2단계: 무게 측정</h3>
                  <p className="text-sm text-gray-500 mt-1">저울 사진을 찍고 실제 무게를 입력해주세요.</p>
                </div>
                <PhotoUpload photo={scalePhoto} setter={setScalePhoto} label="저울 사진 촬영/선택" color="green" handlePhotoChange={handlePhotoChange} />
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">실제 수거 무게 (kg) *</label>
                  <input type="number" step="0.1" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} placeholder="예: 15.5"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none text-lg font-bold text-center" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCompleteModal(m => ({ ...m, step: 1 }))} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl">{'<'} 이전</button>
                  <button type="button" onClick={() => { if (!actualWeight) { alert('무게를 입력해주세요.'); return; } setCompleteModal(m => ({ ...m, step: 3 })); }} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl">다음 {'>'}</button>
                </div>
              </div>
            )}

            {/* Step 3: 특이사항 + 완료 */}
            {completeModal.step === 3 && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">{'📝'}</div>
                  <h3 className="text-lg font-bold text-gray-900">3단계: 특이사항</h3>
                  <p className="text-sm text-gray-500 mt-1">추가 사진이나 메모를 남겨주세요. (선택)</p>
                </div>
                <PhotoUpload photo={extraPhoto} setter={setExtraPhoto} label="추가 사진 (선택)" color="purple" handlePhotoChange={handlePhotoChange} />
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">기사 메모</label>
                  <textarea value={driverNote} onChange={(e) => setDriverNote(e.target.value)} placeholder="특이사항을 입력하세요"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none h-20" />
                </div>
                {/* 요약 */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-bold text-gray-800">{'📋'} 수거 완료 요약</h4>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">실제 무게</span><span className="font-bold text-gray-900">{actualWeight} kg</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">물품 사진</span><span className={itemPhoto ? 'text-green-600 font-bold' : 'text-gray-400'}>{itemPhoto ? '첨부 완료' : '미첨부'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">저울 사진</span><span className={scalePhoto ? 'text-green-600 font-bold' : 'text-gray-400'}>{scalePhoto ? '첨부 완료' : '미첨부'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">특이사항 사진</span><span className={extraPhoto ? 'text-green-600 font-bold' : 'text-gray-400'}>{extraPhoto ? '첨부 완료' : '미첨부'}</span></div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCompleteModal(m => ({ ...m, step: 2 }))} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl">{'<'} 이전</button>
                  <button type="button" onClick={submitComplete} disabled={submitting} className={`flex flex-1 items-center justify-center gap-2 py-3 font-bold rounded-xl ${submitting ? 'bg-gray-400 text-gray-200' : 'bg-blue-600 text-white shadow-lg'}`}>
                    {submitting && <Spinner className="w-5 h-5 text-current" />}
                    {submitting ? '처리 중...' : '수거 완료!'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setViewingPhoto(null)}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <img src={viewingPhoto} alt="확대된 사진" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* SMS Template Modal */}
      {selectedSmsReq && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:w-auto sm:min-w-[360px] rounded-t-3xl sm:rounded-3xl p-6 animate-slideUp">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-900">문자 메시지 보내기</h3>
              <button onClick={() => setSelectedSmsReq(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">전송할 메시지 템플릿을 선택하세요. 메시지 앱이 열리며 자동 완성됩니다.</p>
            
            <div className="space-y-3">
              <a 
                href={`sms:${selectedSmsReq.req.phone}?body=${encodeURIComponent(getSmsTemplate1(selectedSmsReq.displayId))}`}
                onClick={() => setSelectedSmsReq(null)}
                className="block w-full text-left p-4 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="font-bold text-blue-800 mb-1">1. 내일 방문 안내 (수거일 확정)</div>
                <div className="text-xs text-blue-600 line-clamp-2">"안녕하세요! 올클입니다. 내일 헌옷 수거 방문 예정입니다. 수거할 옷과 물품들은..."</div>
              </a>
              
              <a 
                href={`sms:${selectedSmsReq.req.phone}?body=${encodeURIComponent(getSmsTemplate2())}`}
                onClick={() => setSelectedSmsReq(null)}
                className="block w-full text-left p-4 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <div className="font-bold text-indigo-800 mb-1">2. 수거 출발 안내</div>
                <div className="text-xs text-indigo-600 line-clamp-2">"안녕하세요! 올클입니다. 지금 고객님 댁으로 수거하러 출발합니다..."</div>
              </a>
              
              <a 
                href={`sms:${selectedSmsReq.req.phone}?body=${encodeURIComponent(getSmsTemplate3(selectedSmsReq.req))}`}
                onClick={() => setSelectedSmsReq(null)}
                className="block w-full text-left p-4 rounded-xl border border-green-100 bg-green-50 hover:bg-green-100 transition-colors"
              >
                <div className="font-bold text-green-800 mb-1">3. 수거 완료 안내</div>
                <div className="text-xs text-green-600 line-clamp-2">"안녕하세요! 올클입니다. 고객님의 헌옷 수거가 완료되었습니다..."</div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveMainTab('route')} className={`flex flex-col items-center transition-colors ${activeMainTab === 'route' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
          <span className="text-[10px] font-bold">동선</span>
        </button>
        <button onClick={() => setActiveMainTab('profile')} className={`flex flex-col items-center transition-colors ${activeMainTab === 'profile' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span className="text-[10px] font-bold">내 정보</span>
        </button>
      </div>
      </div>
      
      {/* 인쇄용 화면 (프린트 시에만 보임) */}
      <div className="hidden print:block p-8 bg-white text-black">
        <h1 className="text-2xl font-bold mb-6 text-center">오늘의 수거 리스트 ({new Date().toLocaleDateString('ko-KR')})</h1>
        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-center">순번</th>
              <th className="border border-black p-2 text-left">주소</th>
              <th className="border border-black p-2 text-left">상세주소</th>
              <th className="border border-black p-2 text-center">고객명</th>
              <th className="border border-black p-2 text-center">연락처</th>
              <th className="border border-black p-2 text-center">예상수거량</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req, idx) => (
              <tr key={req.id}>
                <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                <td className="border border-black p-2">{req.address}</td>
                <td className="border border-black p-2">{req.detailAddress}</td>
                <td className="border border-black p-2 text-center">{req.userName}</td>
                <td className="border border-black p-2 text-center">{req.phone}</td>
                <td className="border border-black p-2 text-center">{req.estimatedVolume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

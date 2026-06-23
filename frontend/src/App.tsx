import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RequestForm from './pages/RequestForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import LoginSuccess from './pages/LoginSuccess';
import CustomerDashboard from './pages/CustomerDashboard';
import ProtectedRoute from './components/ProtectedRoute';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * 올클(ALL-CLEAR) 홈 화면
 * - 전체 배경: 올클 로고 이미지 (/allclear-logo.png) 꽉 채우기
 * - 하단 버튼 2개:
 *   1) 카카오 로그인 버튼 (이미지 하단 "모두 비우고" 위 공간)
 *   2) 관리자/사장님/기사님 로그인 링크 (최하단)
 */
function Home() {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  // 이미 로그인된 토큰이 있으면 해당 대시보드로 즉시 리다이렉트 (PWA iOS 버그 방지용)
  useEffect(() => {
    if (localStorage.getItem('admin_token')) navigate('/super-admin');
    else if (localStorage.getItem('partner_token')) navigate('/admin');
    else if (localStorage.getItem('driver_token')) navigate('/driver');
    else if (localStorage.getItem('customer_token')) navigate('/status');
  }, [navigate]);

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      alert('라이브 서버에 80건의 테스트 데이터를 꽂아넣습니다. 잠시만 기다려주세요...');
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/debug/seed-suwon`);
      alert('성공! 80건의 테스트 데이터가 들어갔습니다. 이제 데모 로그인으로 확인해보세요.');
    } catch (e) {
      alert('데이터 생성에 실패했습니다.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#F0EDE6]">
      
      {/* 1. 배경 화면 전체 채우기 */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: 'url(/allclear-logo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* 2. 플로팅 버튼 컨테이너 (모바일 사이즈 중앙 정렬) */}
      <div className="absolute inset-0 w-full max-w-[450px] mx-auto pointer-events-none flex flex-col justify-end pb-8">
        
        {/* 버튼 1: 카카오 로그인 (배경화면 텍스트의 '위쪽' 빈 공간) */}
        <div className="px-8 pointer-events-auto mb-6">
          <a
            href={`${import.meta.env.VITE_API_URL}/auth/kakao`}
            className="flex items-center justify-center gap-2 w-full py-4 text-base font-bold text-yellow-900 rounded-2xl shadow-lg hover:brightness-95 transition-all active:scale-[0.98]"
            style={{ background: '#FEE500' }}
          >
            {/* 카카오 말풍선 아이콘 */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <ellipse cx="11" cy="10" rx="9" ry="7.5" fill="#3C1E1E"/>
              <path d="M6 14l1.5-3.5" stroke="#FEE500" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            카카오로 3초만에 시작하기
          </a>
        </div>

        {/* 버튼 2: 관계자 로그인 및 데이터 생성 */}
        <div className="text-center pointer-events-auto mt-auto pb-4 flex flex-col gap-4 items-center">
          <button 
            onClick={() => navigate('/staff-login')}
            className="text-xs font-medium text-gray-500 opacity-60 hover:opacity-100 transition-opacity underline underline-offset-4"
          >
            기사님 및 파트너 로그인
          </button>
          
          <button 
            onClick={handleSeedData}
            disabled={seeding}
            className="text-[10px] bg-black/20 text-white px-3 py-1.5 rounded-full hover:bg-black/40 transition-colors backdrop-blur-sm"
          >
            {seeding ? '데이터 꽂는 중...' : '🛠️ 테스트 데이터 80건 자동 생성'}
          </button>
        </div>

      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-primary-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/staff-login" element={<Login />} />
          <Route path="/request" element={<RequestForm />} />
          <Route path="/login-success" element={<LoginSuccess />} />
          <Route path="/status" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} redirectTo="/staff-login"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['PARTNER']} redirectTo="/staff-login"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute allowedRoles={['DRIVER', 'PARTNER']} redirectTo="/staff-login"><DriverDashboard /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

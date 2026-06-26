import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RequestForm from './pages/RequestForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import LoginSuccess from './pages/LoginSuccess';
import CustomerDashboard from './pages/CustomerDashboard';
import ProtectedRoute from './components/ProtectedRoute';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 올클(ALL-CLEAR) 홈 화면
 * - 전체 배경: 올클 로고 이미지 (/allclear-logo.png) 꽉 채우기
 * - 하단 버튼 2개:
 *   1) 카카오 로그인 버튼 (이미지 하단 "모두 비우고" 위 공간)
 */
function Home() {
  const navigate = useNavigate();
  // 이미 로그인된 토큰이 있으면 해당 대시보드로 즉시 리다이렉트 (PWA iOS 버그 방지용)
  useEffect(() => {
    if (localStorage.getItem('superadmin_token')) navigate('/super-admin');
    else if (localStorage.getItem('admin_token')) navigate('/admin');
    else if (localStorage.getItem('driver_token')) navigate('/driver');
    else if (localStorage.getItem('customer_token') && localStorage.getItem('auth_token')) navigate('/status');
  }, [navigate]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#F0EDE6] flex items-center justify-center">
      
      {/* 모바일 화면 크기의 중앙 컨테이너 */}
      <div className="relative w-full max-w-[450px] h-full shadow-2xl flex flex-col justify-end pb-8">
        
        {/* 배경 이미지 */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: 'url(/allclear-logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* 카카오 로그인 버튼 */}
        <div className="relative z-10 px-8 mb-[85px]">
          <a
            href={`${import.meta.env.VITE_API_URL}/auth/kakao`}
            className="flex items-center justify-center gap-2 w-full py-4 text-base font-bold text-yellow-900 rounded-2xl shadow-lg hover:brightness-95 transition-all active:scale-[0.98]"
            style={{ background: '#FEE500' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <ellipse cx="11" cy="10" rx="9" ry="7.5" fill="#3C1E1E"/>
              <path d="M6 14l1.5-3.5" stroke="#FEE500" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            카카오로 3초만에 시작하기
          </a>
        </div>

      </div>
    </div>
  );
}

import GlobalNoticeBanner from './components/GlobalNoticeBanner';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-primary-100">
        <GlobalNoticeBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/staff-login" element={<Login />} />
          <Route path="/login" element={<Navigate to="/staff-login" replace />} />
          <Route path="/request" element={<RequestForm />} />
          <Route path="/login-success" element={<LoginSuccess />} />
          <Route path="/status" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} redirectTo="/staff-login"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['PARTNER']} redirectTo="/staff-login"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute allowedRoles={['DRIVER', 'PARTNER']} redirectTo="/staff-login"><DriverDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

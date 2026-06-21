import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import RequestForm from './pages/RequestForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import LoginSuccess from './pages/LoginSuccess';
import CustomerDashboard from './pages/CustomerDashboard';
import ProtectedRoute from './components/ProtectedRoute';

/**
 * 올클(ALL-CLEAR) 홈 화면
 * - 전체 배경: 올클 로고 이미지 (/allclear-logo.png) 꽉 채우기
 * - 하단 버튼 2개:
 *   1) 카카오 로그인 버튼 (이미지 하단 "모두 비우고" 위 공간)
 *   2) 관리자/사장님/기사님 로그인 링크 (최하단)
 */
function Home() {
  return (
    <div
      className="relative flex flex-col min-h-screen"
      style={{
        backgroundImage: 'url(/allclear-logo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#F0EDE6', // 이미지 로드 전 fallback 배경
      }}
    >
      {/* 버튼 2개를 하단에 고정 배치 (배경 이미지의 텍스트 위/아래로 위치) */}
      <div className="absolute bottom-0 left-0 right-0 px-8 pb-10 flex flex-col justify-end">

        {/* 버튼 1: 카카오 로그인 (배경 이미지 텍스트 위) */}
        <a
          href={`${import.meta.env.VITE_API_URL}/auth/kakao`}
          className="flex items-center justify-center gap-2 w-full py-4 mb-16 text-base font-bold text-yellow-900 rounded-2xl shadow-lg hover:brightness-95 transition-all active:scale-[0.98]"
          style={{ background: '#FEE500' }}
        >
          {/* 카카오 말풍선 아이콘 */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <ellipse cx="11" cy="10" rx="9" ry="7.5" fill="#3C1E1E"/>
            <path d="M6 14l1.5-3.5" stroke="#FEE500" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          카카오로 3초만에 시작하기
        </a>

        {/* 버튼 2: 관리자 로그인 (배경 이미지 텍스트 아래) */}
        <Link
          to="/login"
          className="flex items-center justify-center gap-2 w-full py-4 text-sm font-bold rounded-2xl transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(90,92,99,0.2)',
            color: '#5A5C63',
          }}
        >
          슈퍼관리자 · 사장님 · 기사님 로그인
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
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
          <Route path="/login" element={<Login />} />
          <Route path="/request" element={<RequestForm />} />
          <Route path="/login-success" element={<LoginSuccess />} />
          <Route path="/status" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} redirectTo="/login"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['PARTNER']} redirectTo="/login"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute allowedRoles={['DRIVER']} redirectTo="/login"><DriverDashboard /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

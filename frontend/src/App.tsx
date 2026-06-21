import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import RequestForm from './pages/RequestForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import LoginSuccess from './pages/LoginSuccess';
import CustomerDashboard from './pages/CustomerDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function Home() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-6"
      style={{ background: 'linear-gradient(180deg, #F0EDE6 0%, #EAE5DC 100%)' }}
    >
      <div className="w-full max-w-sm space-y-0 text-center flex flex-col items-center">

        {/* 올클 로고 이미지 */}
        <div className="mb-8">
          <img
            src="/allcleare-logo.png"
            alt="올클 ALL-CLEAR 로고"
            className="w-64 h-auto mx-auto"
          />
        </div>

        {/* 서비스 소개 문구 */}
        <p
          className="text-sm font-medium mb-10 leading-relaxed"
          style={{ color: '#8D8F96' }}
        >
          집에서 편하게 신청하고,<br />
          원하는 시간에 기사님이 방문합니다.
        </p>

        {/* 카카오 로그인 버튼 */}
        <div className="w-full space-y-3">
          <a
            href={`${import.meta.env.VITE_API_URL}/auth/kakao`}
            className="flex items-center justify-center gap-3 w-full py-4 text-base font-bold text-yellow-900 rounded-2xl shadow-md hover:brightness-95 transition-all active:scale-95"
            style={{ background: '#FEE500' }}
          >
            {/* 카카오 아이콘 */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C5.58 2 2 4.86 2 8.4c0 2.22 1.48 4.17 3.72 5.3l-.95 3.55 4.17-2.74c.34.05.69.07 1.06.07 4.42 0 8-2.86 8-6.4S14.42 2 10 2z" fill="#3C1E1E"/>
            </svg>
            카카오로 3초만에 시작하기
          </a>

          <p className="text-xs" style={{ color: '#AEAFB4' }}>
            로그인 시 수거 신청 및 실시간 내역 조회가 가능합니다.
          </p>
        </div>

        {/* 관리자 로그인 링크 */}
        <div className="pt-10">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 px-5 py-2 text-xs font-bold rounded-full transition-all"
            style={{ background: '#E0D8CC', color: '#5A5C63' }}
          >
            슈퍼관리자 · 사장님 · 기사님 로그인
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* 하단 슬로건 */}
        <p className="pt-8 text-xs" style={{ color: '#C8C9CD' }}>
          모두 비우고, 깨끗하게
        </p>
      </div>
    </div>
  );
}


function App() {
  return (
    <Router>
      <div className="min-h-screen font-sans selection:bg-gray-200" style={{ background: '#F0EDE6', color: '#1E2024' }}>
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

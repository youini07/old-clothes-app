import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import RequestForm from './pages/RequestForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import LoginSuccess from './pages/LoginSuccess';
import CustomerDashboard from './pages/CustomerDashboard';
import ProtectedRoute from './components/ProtectedRoute';

// 올클(ALL-CLEAR) 홈 화면
// 크림/베이지 배경 + 올클 텍스트 로고 + 카카오 버튼
function Home() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-6"
      style={{ background: 'linear-gradient(180deg, #F0EDE6 0%, #EAE5DC 100%)' }}
    >
      <div className="w-full max-w-sm text-center flex flex-col items-center">

        {/* 올클 텍스트 로고 영역 */}
        <div className="mb-10 space-y-3">
          {/* 옷걸이 아이콘 (SVG) */}
          <div className="flex justify-center mb-4">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path d="M32 10C28 10 25 13 25 16.5C25 17.3 25.7 18 26.5 18S28 17.3 28 16.5C28 14.6 29.8 13 32 13C34.2 13 36 14.6 36 16.5C36 18 35.1 19.2 33.8 19.8L12 32H52L32 20.2C33.1 19.5 34 18.2 34 16.5C34 13 31.3 10 32 10Z" fill="#8D8F96"/>
              <path d="M10 32L8 36H56L54 32H10Z" fill="#6B6D74"/>
              <path d="M32 14V20" stroke="#8D8F96" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="32" cy="11" r="2.5" fill="#8D8F96"/>
            </svg>
          </div>

          {/* ALL-CLEAR 텍스트 */}
          <div
            className="inline-block px-6 py-1.5 text-2xl font-black tracking-widest"
            style={{ background: '#8D8F96', color: '#FFFFFF', borderRadius: '4px', letterSpacing: '0.12em' }}
          >
            ALL-CLEAR
          </div>

          {/* 올클 한글 */}
          <div className="text-5xl font-black" style={{ color: '#3A3C41', letterSpacing: '-0.02em' }}>
            올클
          </div>

          {/* 헌옷 → 돈 일러스트 텍스트 */}
          <div className="flex items-center justify-center gap-3 py-3 text-2xl">
            <span>👕</span>
            <span style={{ color: '#C8C9CD' }}>- - →</span>
            <span>💰</span>
          </div>
        </div>

        {/* 슬로건 */}
        <p className="text-sm font-medium mb-10 leading-relaxed" style={{ color: '#8D8F96' }}>
          모두 비우고, 깨끗하게<br />
          <span className="text-xs" style={{ color: '#AEAFB4' }}>(All clear, clean all)</span>
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
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      {/* 다른 페이지는 원래 gray-50 배경 유지, Home만 크림 배경 */}
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

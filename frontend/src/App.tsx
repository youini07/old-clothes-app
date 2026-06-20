import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import RequestForm from './pages/RequestForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DriverDashboard from './pages/DriverDashboard';

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-primary-50 to-white">
      <div className="w-full max-w-md space-y-8 text-center">
        <h1 className="text-4xl font-extrabold text-primary-900 tracking-tight">헌옷수거<br/>쉽고 빠르게!</h1>
        <p className="text-gray-600 font-medium">
          집에서 편하게 신청하고, <br/>원하는 시간에 기사님이 방문합니다.
        </p>
        
        <div className="pt-8 space-y-4">
          <Link to="/request" className="block w-full py-4 text-lg font-semibold text-white bg-primary-600 rounded-xl shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all transform active:scale-95">
            수거 신청하기
          </Link>
          <a href={`${import.meta.env.VITE_API_URL}/auth/kakao`} className="block w-full py-4 text-lg font-bold text-yellow-900 bg-[#FEE500] rounded-xl shadow-md hover:bg-yellow-400 transition-all transform active:scale-95">
            카카오로 시작하기 (고객용)
          </a>
        </div>
        
        <div className="pt-12">
          <Link to="/login" className="inline-block px-6 py-2 text-sm font-bold text-gray-500 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            슈퍼관리자 / 사장님 / 기사님 로그인 👉
          </Link>
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
          <Route path="/login" element={<Login />} />
          <Route path="/request" element={<RequestForm />} />
          <Route path="/status" element={<div className="p-6">신청 내역 확인 화면 준비 중...</div>} />
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/driver" element={<DriverDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

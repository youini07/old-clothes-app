import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/login`, {
        email,
        password
      });

      const { token, user } = res.data;
      
      // 토큰 및 사용자 정보 저장
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_info', JSON.stringify(user));

      // 역할에 따른 라우팅 및 토큰 저장 (각 대시보드가 읽는 키가 다름)
      if (user.role === 'SUPER_ADMIN') {
        localStorage.setItem('superadmin_token', token);
        navigate('/super-admin');
      } else if (user.role === 'PARTNER') {
        localStorage.setItem('admin_token', token);
        navigate('/admin'); // 파트너 대시보드(AdminDashboard)로 이동
      } else if (user.role === 'DRIVER') {
        localStorage.setItem('driver_token', token);
        navigate('/driver'); // 기사 대시보드로 이동
      } else {
        alert('관리자 권한이 없습니다.');
        localStorage.clear();
      }

    } catch (error: any) {
      const msg = error.response?.data?.error || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        
        {/* 상단 장식 */}
        <div className="bg-primary-600 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white opacity-10"></div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-sm text-white/70 hover:text-white transition-colors mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            홈으로 돌아가기
          </button>
          <h1 className="text-3xl font-extrabold text-white relative z-10 tracking-tight">
            헌옷수거 통합 로그인
          </h1>
          <p className="text-primary-100 mt-2 relative z-10 text-sm font-medium">
            슈퍼 관리자 / 사장님 / 기사님 전용
          </p>
        </div>

        {/* 로그인 폼 */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">이메일 (ID)</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                placeholder="admin@test.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${
                loading ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 hover:shadow-primary-500/30 active:scale-[0.98]'
              }`}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>초기 비밀번호 안내</p>
            <p className="mt-1">사장님: 등록된 휴대폰 번호</p>
          </div>
        </div>
      </div>
    </div>
  );
}

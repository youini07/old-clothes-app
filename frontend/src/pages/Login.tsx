import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleDemoLogin = async (role: 'PARTNER' | 'DRIVER') => {
    setLoading(true);
    try {
      if (role === 'DRIVER') {
        try {
          await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role: 'PARTNER' });
        } catch (e) {}
      }

      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role });
      const { token, user } = res.data;

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_info', JSON.stringify(user));

      if (role === 'PARTNER') {
        localStorage.setItem('admin_token', token);
        navigate('/admin');
      } else if (role === 'DRIVER') {
        localStorage.setItem('driver_token', token);
        navigate('/driver');
      }
    } catch (error: any) {
      alert('데모 로그인 실패: ' + (error.response?.data?.error || '서버 오류'));
    } finally {
      setLoading(false);
    }
  };

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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-400 font-semibold">데모 원클릭 로그인</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDemoLogin('PARTNER')}
              type="button"
              className="py-3 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold rounded-2xl text-sm transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
            >
              🏢 사장님 데모
            </button>
            <button
              onClick={() => handleDemoLogin('DRIVER')}
              type="button"
              className="py-3 px-4 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-950 font-bold rounded-2xl text-sm transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
            >
              🚚 기사님 데모
            </button>
          </div>
          
          <div className="mt-4 flex justify-center">
            <button 
              type="button"
              onClick={async () => {
                try {
                  setLoading(true);
                  alert('라이브 서버에 30건의 테스트 데이터를 꽂아넣습니다. 약 3~5초 정도 소요됩니다.');
                  await axios.get(`${import.meta.env.VITE_API_URL}/admin/debug/seed-suwon`);
                  alert('성공! 30건의 테스트 데이터가 들어갔습니다. 이제 사장님 데모로 로그인해보세요.');
                } catch (e) {
                  alert('데이터 생성에 실패했습니다. (이미 생성되었거나 서버 오류입니다.)');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="text-xs bg-gray-800 text-white px-4 py-2 rounded-xl shadow-md hover:bg-gray-900 transition-colors"
            >
              {loading ? '데이터 꽂는 중...' : '🛠️ 테스트 데이터 30건 즉시 자동 생성'}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>초기 비밀번호 안내</p>
            <p className="mt-1">사장님: 등록된 휴대폰 번호</p>
          </div>
        </div>
      </div>
    </div>
  );
}

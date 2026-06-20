import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginSuccess() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // URL 파라미터에서 토큰과 유저 정보 추출
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const name = params.get('name');
    const role = params.get('role');

    if (token) {
      // 로컬 스토리지에 토큰 저장
      localStorage.setItem('auth_token', token);
      
      if (name && role) {
        localStorage.setItem('user_info', JSON.stringify({ name, role }));
      }

      // 2초 후 마이페이지(CustomerDashboard)로 이동
      const timer = setTimeout(() => {
        navigate('/status');
      }, 2000);
    } else {
      alert('로그인 처리에 실패했습니다. 다시 시도해주세요.');
      navigate('/');
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">로그인 성공!</h2>
        <p className="text-gray-500 font-medium">안전하게 로그인되었습니다.<br/>잠시 후 이동합니다...</p>
      </div>
    </div>
  );
}

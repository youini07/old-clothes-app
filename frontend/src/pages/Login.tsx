import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import AddressSearchModal from '../components/AddressSearchModal';

interface PartnerOption {
  id: string;
  businessName: string | null;
  name: string;
}

export default function Login() {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [registerRole, setRegisterRole] = useState<'PARTNER' | 'DRIVER'>('PARTNER');
  
  // Login State
  const [email, setEmail] = useState(() => localStorage.getItem('auto_login') === 'true' ? localStorage.getItem('saved_email') || '' : '');
  const [password, setPassword] = useState(() => localStorage.getItem('auto_login') === 'true' ? localStorage.getItem('saved_password') || '' : '');
  const [autoLogin, setAutoLogin] = useState(() => localStorage.getItem('auto_login') === 'true');
  
  // Register State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regVehicleInfo, setRegVehicleInfo] = useState('');
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regDetailAddress, setRegDetailAddress] = useState('');
  const [regZipCode, setRegZipCode] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchPartners = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/auth/partners`);
      setPartnerOptions(res.data);
    } catch (error) {
      console.error('파트너 목록 로드 실패', error);
    }
  };

  useEffect(() => {
    if (mode === 'REGISTER' && registerRole === 'DRIVER') {
      fetchPartners();
    }
  }, [mode, registerRole]);

  const handleDemoLogin = async (role: 'PARTNER' | 'DRIVER') => {
    setLoading(true);
    try {
      if (role === 'DRIVER') {
        try {
          await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role: 'PARTNER' });
        } catch (e) {
          console.error(e);
        }
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

      if (autoLogin) {
        localStorage.setItem('saved_email', email);
        localStorage.setItem('saved_password', password);
        localStorage.setItem('auto_login', 'true');
      } else {
        localStorage.removeItem('saved_email');
        localStorage.removeItem('saved_password');
        localStorage.setItem('auto_login', 'false');
      }

      const { token, user } = res.data;
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_info', JSON.stringify(user));

      if (user.role === 'SUPER_ADMIN') {
        localStorage.setItem('superadmin_token', token);
        navigate('/super-admin');
      } else if (user.role === 'PARTNER') {
        localStorage.setItem('admin_token', token);
        navigate('/admin');
      } else if (user.role === 'DRIVER') {
        localStorage.setItem('driver_token', token);
        navigate('/driver');
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (regPassword !== regPasswordConfirm) {
      return alert('비밀번호가 일치하지 않습니다.');
    }
    
    if (registerRole === 'DRIVER' && !selectedPartnerId) {
      return alert('소속 사장님(업체)을 선택해주세요.');
    }

    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/register`, {
        role: registerRole,
        name: regName,
        phone: regPhone,
        email: regEmail,
        password: regPassword,
        partnerId: selectedPartnerId,
        vehicleInfo: regVehicleInfo,
        businessName: regBusinessName,
        address: regAddress,
        detailAddress: regDetailAddress,
        zipCode: regZipCode
      });

      alert('회원가입이 완료되었습니다. 환영합니다!');
      
      const { token, user } = res.data;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_info', JSON.stringify(user));

      if (user.role === 'PARTNER') {
        localStorage.setItem('admin_token', token);
        navigate('/admin');
      } else if (user.role === 'DRIVER') {
        localStorage.setItem('driver_token', token);
        navigate('/driver');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || '회원가입에 실패했습니다.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        
        {/* 상단 장식 */}
        <div className="bg-primary-600 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white opacity-10"></div>
          <button
            type="button"
            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
            className="flex items-center text-sm text-white/70 hover:text-white transition-colors mb-4 relative z-20"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            고객 로그인 페이지로 가기
          </button>
          <h1 className="text-3xl font-extrabold text-white relative z-10 tracking-tight">
            올클 통합 파트너
          </h1>
          <p className="text-primary-100 mt-2 relative z-10 text-sm font-medium">
            사장님 / 기사님 전용 업무시스템
          </p>
        </div>

        {/* 탭 전환 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMode('LOGIN')}
            className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
              mode === 'LOGIN' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setMode('REGISTER')}
            className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
              mode === 'REGISTER' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            회원가입
          </button>
        </div>

        <div className="p-8">
          {mode === 'LOGIN' && (
            <>
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

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoLogin"
                    checked={autoLogin}
                    onChange={e => setAutoLogin(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="autoLogin" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                    아이디/비밀번호 저장 (자동 로그인)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center items-center gap-2 py-4 rounded-xl font-bold text-white shadow-lg transition-all ${
                    loading ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 hover:shadow-primary-500/30 active:scale-[0.98]'
                  }`}
                >
                  {loading && <Spinner className="w-5 h-5 text-white" />}
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </form>
              
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400 font-semibold">영업 및 시연용 데모 로그인</span>
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
            </>
          )}

          {mode === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-5">
              {/* 가입 유형 선택 */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setRegisterRole('PARTNER')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    registerRole === 'PARTNER' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🏢 사장님 가입
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterRole('DRIVER')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    registerRole === 'DRIVER' ? 'bg-white shadow text-sky-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🚚 기사님 가입
                </button>
              </div>

              {registerRole === 'DRIVER' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">소속 사장님(업체) 선택</label>
                  <select
                    required
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors outline-none text-sm"
                  >
                    <option value="">-- 소속 사장님을 선택하세요 --</option>
                    {partnerOptions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.businessName ? `${p.businessName} (${p.name})` : p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {registerRole === 'PARTNER' && (
                <>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">업체명 (상호명)</label>
                  <input
                    type="text"
                    required
                    value={regBusinessName}
                    onChange={e => setRegBusinessName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                    placeholder="올클 헌옷수거 (용인점)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">사업장 주소</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      readOnly
                      required
                      value={regZipCode}
                      placeholder="우편번호"
                      className="w-1/3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setIsAddressModalOpen(true)}
                      className="w-2/3 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors"
                    >
                      주소 찾기
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    required
                    value={regAddress}
                    placeholder="기본 주소"
                    className="w-full px-4 py-3 mb-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  />
                  <input
                    type="text"
                    value={regDetailAddress}
                    onChange={e => setRegDetailAddress(e.target.value)}
                    placeholder="상세 주소 (입력)"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                  />
                </div>
                </>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">이름</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">전화번호</label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                  placeholder="010-0000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">이메일 (아이디로 사용)</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">비밀번호 확인</label>
                <input
                  type="password"
                  required
                  value={regPasswordConfirm}
                  onChange={e => setRegPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors outline-none"
                  placeholder="••••••••"
                />
              </div>

              {registerRole === 'DRIVER' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">차량 번호 (선택)</label>
                  <input
                    type="text"
                    value={regVehicleInfo}
                    onChange={e => setRegVehicleInfo(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors outline-none"
                    placeholder="12가 3456 (1톤 트럭 등)"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center items-center gap-2 py-4 mt-6 rounded-xl font-bold text-white shadow-lg transition-all ${
                  loading ? 'bg-primary-400 cursor-not-allowed' : (registerRole === 'PARTNER' ? 'bg-primary-600 hover:bg-primary-700 hover:shadow-primary-500/30' : 'bg-sky-600 hover:bg-sky-700 hover:shadow-sky-500/30')
                } active:scale-[0.98]`}
              >
                {loading && <Spinner className="w-5 h-5 text-white" />}
                {loading ? '처리 중...' : '회원가입 완료'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
      <AddressSearchModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onComplete={(data) => {
          setRegAddress(data.address);
          setRegZipCode(data.zonecode);
          setRegDetailAddress('');
        }}
      />
    </>
  );
}

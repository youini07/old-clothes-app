import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{name: string, role: string} | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'requests' | 'profile'>('requests');

  // Profile State
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_info');
    
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/');
      return;
    }

    if (userStr) {
      setUserInfo(JSON.parse(userStr));
    }

    fetchMyRequests(token);
    fetchMyProfile(token);
  }, [navigate]);

  const fetchMyRequests = async (token: string) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/requests/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data.requests);
    } catch (error) {
      console.error('내 신청내역 조회 에러:', error);
      alert('신청 내역을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyProfile = async (token: string) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfileName(res.data.user.name || '');
      setProfilePhone(res.data.user.phone || '');
    } catch (error) {
      console.error('내 정보 조회 에러:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.patch(`${import.meta.env.VITE_API_URL}/auth/profile`, {
        name: profileName,
        phone: profilePhone
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('정보가 성공적으로 수정되었습니다.');
      
      const updatedUser = res.data.user;
      setUserInfo(prev => prev ? { ...prev, name: updatedUser.name } : { name: updatedUser.name, role: updatedUser.role });
      localStorage.setItem('user_info', JSON.stringify({ name: updatedUser.name, role: updatedUser.role }));
    } catch (error) {
      console.error('정보 수정 에러:', error);
      alert('정보 수정에 실패했습니다.');
    } finally {
      setSavingProfile(false);
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'PENDING': return '예약 접수';
      case 'ASSIGNED': return '업체 확인/배정';
      case 'SCHEDULED': return '방문일정 확정';
      case 'COMPLETED': return '수거 완료';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      case 'ASSIGNED': return 'bg-yellow-100 text-yellow-800';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const steps = [
    { key: 'PENDING', label: '예약 접수' },
    { key: 'ASSIGNED', label: '업체 배정' },
    { key: 'SCHEDULED', label: '일정 확정' },
    { key: 'COMPLETED', label: '수거 완료' }
  ];

  const getStepIndex = (status: string) => {
    return steps.findIndex(s => s.key === status) || 0;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">로딩중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-600 text-white p-6 pt-12 pb-8 rounded-b-3xl shadow-md">
        <button
          onClick={() => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            navigate('/');
          }}
          className="flex items-center text-sm text-white/70 hover:text-white transition-colors mb-3"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          로그아웃
        </button>
        <h1 className="text-2xl font-bold">{userInfo?.name || '고객'}님의 대시보드</h1>
        <p className="opacity-80 mt-1">나의 수거 현황과 정보를 관리하세요.</p>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Tabs */}
        <div className="flex bg-gray-200 p-1 rounded-2xl mb-6">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'requests' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            수거 신청 내역
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'profile' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            내 정보 관리
          </button>
        </div>

        {activeTab === 'requests' && (
          <div className="space-y-6">
            <Link 
              to="/request" 
              className="block w-full text-center py-4 text-lg font-bold text-white bg-blue-600 rounded-2xl shadow-lg hover:bg-blue-700 transition-all active:scale-95"
            >
              + 새로운 수거 신청하기
            </Link>

            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">최근 신청 내역</h2>
              
              {requests.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                  <div className="text-gray-400 mb-3 text-5xl">📦</div>
                  <p className="text-gray-500 font-medium">아직 신청하신 수거 내역이 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-1">집에 잠든 헌옷들을 비워보세요!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map(req => (
                    <div key={req.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(req.status)}`}>
                          {getStatusText(req.status)}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">
                          {new Date(req.createdAt).toLocaleDateString()} 신청
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-gray-800 text-lg mb-1">{req.address}</h3>
                      <p className="text-gray-500 text-sm mb-3">희망일: {new Date(req.desiredDate).toLocaleDateString()}</p>
                      
                      {req.partner && (
                        <div className="bg-gray-50 p-3 rounded-xl mb-3 flex justify-between items-center">
                          <div>
                            <p className="text-xs text-gray-500">배정된 수거업체</p>
                            <p className="text-sm font-bold text-gray-700">{req.partner.businessName}</p>
                          </div>
                        </div>
                      )}

                      {req.status === 'COMPLETED' && req.actualWeight && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-sm font-bold">
                          <span className="text-gray-600">수거 완료된 무게</span>
                          <span className="text-green-600 text-lg">{req.actualWeight} kg</span>
                        </div>
                      )}

                      {/* Progress Bar (Stepper) */}
                      <div className="mt-5 relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full"></div>
                        <div 
                          className="absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2 rounded-full transition-all duration-500"
                          style={{ width: `${(getStepIndex(req.status) / (steps.length - 1)) * 100}%` }}
                        ></div>
                        
                        <div className="relative flex justify-between">
                          {steps.map((step, idx) => {
                            const currentIdx = getStepIndex(req.status);
                            const isCompleted = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            
                            return (
                              <div key={step.key} className="flex flex-col items-center">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 border-2 transition-colors ${isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-400'} ${isCurrent ? 'ring-2 ring-blue-200 ring-offset-2' : ''}`}>
                                  {isCompleted ? '✓' : idx + 1}
                                </div>
                                <span className={`text-[10px] mt-1 font-medium ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900">내 정보 관리</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">이름</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">연락처</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">연락처를 저장해두면 수거 신청 시 자동으로 입력됩니다.</p>
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={`w-full py-4 text-lg font-bold text-white rounded-xl shadow-md transition-all ${
                    savingProfile ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                  }`}
                >
                  {savingProfile ? '저장 중...' : '정보 저장하기'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

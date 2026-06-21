import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface RequestItem {
  id: string;
  userName: string;
  phone: string;
  address: string;
  detailAddress: string;
  estimatedVolume: string;
  status: string;
  driverId: string | null;
  etaMinutes?: number;
}

interface Driver {
  id: string;
  user?: { name: string };
  name?: string; // Fallback
}

export default function AdminDashboard() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('admin_token'));

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });

  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', email: '', vehicleInfo: '' });

  useEffect(() => {
    if (authToken) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [authToken]);

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role: 'PARTNER' });
      const token = res.data.token;
      localStorage.setItem('admin_token', token);
      setAuthToken(token);
    } catch (error) {
      alert('데모 로그인 실패');
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [reqsRes, driversRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/admin/requests`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/admin/drivers`, { headers })
      ]);
      setRequests(reqsRes.data.requests || []);
      setDrivers(driversRes.data.drivers || []);
    } catch (error) {
      console.error('데이터 조회 실패:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setAuthToken(null);
        localStorage.removeItem('admin_token');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) {
      return alert('새 비밀번호가 일치하지 않습니다.');
    }
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/auth/password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.');
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      localStorage.clear();
      window.location.href = '/login';
    } catch (error: any) {
      alert(error.response?.data?.error || '비밀번호 변경 실패');
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/admin/drivers`, driverForm, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert(res.data.message || '기사님이 성공적으로 등록되었습니다.');
      setIsDriverModalOpen(false);
      setDriverForm({ name: '', phone: '', email: '', vehicleInfo: '' });
      fetchData(); // 새 기사님 목록 불러오기
    } catch (error: any) {
      alert(error.response?.data?.error || '기사 등록 중 오류가 발생했습니다.');
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, requestId: string) => {
    e.dataTransfer.setData('requestId', requestId);
  };

  const handleDrop = async (e: React.DragEvent, targetDriverId: string | null) => {
    e.preventDefault();
    if (!authToken) return alert('로그인이 필요합니다.');

    const requestId = e.dataTransfer.getData('requestId');
    
    // UI 즉시 업데이트 (Optimistic Update)
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return { ...req, driverId: targetDriverId, status: targetDriverId ? 'SCHEDULED' : 'PENDING' };
      }
      return req;
    }));

    // 서버로 API 전송 (기사 배정은 /admin/assign-driver 사용)
    try {
      if (targetDriverId) {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/assign-driver`, {
          requestId,
          driverId: targetDriverId,
          confirmedDate: new Date()
        }, { headers: { Authorization: `Bearer ${authToken}` } });
      } else {
        // 배정 해제 (미지원 시 기존 patch api 사용)
        await axios.patch(`${import.meta.env.VITE_API_URL}/requests/${requestId}/assign`, {
          driverId: null
        }, { headers: { Authorization: `Bearer ${authToken}` } });
      }
    } catch (error) {
      console.error('배정 실패, 롤백');
      alert('기사 배정에 실패했습니다.');
      fetchData(); // 롤백
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // 드롭 허용
  };

  const unassignedRequests = requests.filter(r => !r.driverId);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="glass p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              지역 파트너 <span className="text-gradient">배차 대시보드</span>
            </h1>
            <p className="text-gray-500 mt-2 font-medium">우리 지역에 접수된 수거 요청을 기사님들께 드래그 앤 드롭으로 배정하세요.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                localStorage.removeItem('admin_token');
                window.location.href = '/login';
              }}
              className="flex items-center px-4 py-3 text-sm text-gray-500 bg-gray-100 font-bold rounded-xl hover:bg-gray-200 transition-all"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              로그아웃
            </button>
            {!authToken ? (
              <button onClick={handleDemoLogin} className="px-6 py-3 bg-yellow-400 text-yellow-900 font-bold rounded-xl shadow-md hover:bg-yellow-500 transition-all active:scale-95">
                데모 로그인 (파트너)
              </button>
            ) : (
              <button 
                onClick={() => setIsPasswordModalOpen(true)}
                className="px-4 py-3 bg-gray-800 text-white font-bold rounded-xl shadow-md hover:bg-gray-900 transition-all active:scale-95"
              >
                비밀번호 변경
              </button>
            )}
            <button 
              onClick={() => setIsDriverModalOpen(true)}
              className="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-md hover:bg-primary-700 transition-all active:scale-95"
            >
              기사님 추가하기
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Unassigned Requests */}
          <div 
            className="lg:col-span-1 glass-dark rounded-3xl p-6 min-h-[500px] border-gray-200 bg-white shadow-sm"
            onDrop={(e) => handleDrop(e, null)}
            onDragOver={handleDragOver}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">미배정 수거 요청</h2>
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">{unassignedRequests.length}건</span>
            </div>
            
            {loading ? (
              <div className="text-center py-10 text-gray-400">로딩 중...</div>
            ) : unassignedRequests.length === 0 ? (
              <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                미배정 건이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {unassignedRequests.map(req => (
                  <div 
                    key={req.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, req.id)}
                    className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing hover:border-primary-400 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900">{req.userName} <span className="text-sm font-normal text-gray-500">{req.phone}</span></h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{req.address} {req.detailAddress}</p>
                    <div className="mt-3 inline-block bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs font-bold">
                      {req.estimatedVolume}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Drivers */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {drivers.map(driver => {
              const driverRequests = requests.filter(r => r.driverId === driver.id && r.status !== 'COMPLETED');
              const completedRequests = requests.filter(r => r.driverId === driver.id && r.status === 'COMPLETED');

              return (
                <div 
                  key={driver.id} 
                  className="bg-primary-50/50 border-2 border-primary-100 rounded-3xl p-6 min-h-[500px] flex flex-col"
                  onDrop={(e) => handleDrop(e, driver.id)}
                  onDragOver={handleDragOver}
                >
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-primary-200">
                    <h2 className="text-xl font-bold text-primary-900">🚚 {driver.user?.name || driver.name}</h2>
                    <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-bold">{driverRequests.length}건 대기중</span>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    {driverRequests.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-primary-400 font-medium pb-10">
                        여기로 카드를 드래그하여 배정하세요
                      </div>
                    ) : (
                      driverRequests.map((req, idx) => (
                        <div 
                          key={req.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, req.id)}
                          className={`p-4 bg-white border rounded-2xl shadow-sm cursor-grab active:cursor-grabbing transition-all flex gap-3 ${req.status === 'IN_PROGRESS' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-primary-100 hover:border-primary-400'}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${req.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-primary-100 text-primary-800'}`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h3 className="font-bold text-gray-900 text-sm">{req.userName}</h3>
                              {req.status === 'IN_PROGRESS' && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full animate-pulse">
                                  이동 중 {req.etaMinutes ? `(${req.etaMinutes}분)` : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{req.address}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Completed Items Section */}
                  {completedRequests.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-primary-200/50">
                      <h3 className="text-sm font-bold text-gray-600 mb-3">✅ 완료된 수거 ({completedRequests.length}건)</h3>
                      <div className="space-y-2 opacity-70">
                        {completedRequests.map(req => (
                          <div key={req.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                            <div>
                              <p className="text-xs font-bold text-gray-800">{req.userName} <span className="font-normal text-gray-500">님</span></p>
                              <p className="text-[10px] text-gray-500 truncate w-32">{req.address}</p>
                            </div>
                            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">수거완료</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button className="w-full mt-6 py-3 bg-white border-2 border-primary-600 text-primary-600 font-bold rounded-xl hover:bg-primary-50 transition-colors">
                    최적 동선 카카오내비 전송
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">비밀번호 변경</h2>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">현재 비밀번호</label>
                <input required type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="기존 비밀번호 입력" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">새 비밀번호</label>
                <input required type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="새로운 비밀번호" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">새 비밀번호 확인</label>
                <input required type="password" value={passwordForm.newPasswordConfirm} onChange={e => setPasswordForm({...passwordForm, newPasswordConfirm: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="비밀번호 재입력" />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  변경 저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 기사님 추가 모달 */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsDriverModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">기사님 등록</h2>
            <p className="text-sm text-gray-500 mb-6">등록된 기사님의 초기 비밀번호는 입력하신 연락처로 설정됩니다.</p>
            
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">기사님 성함</label>
                <input required type="text" value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">이메일 (ID 겸용)</label>
                <input required type="email" value={driverForm.email} onChange={e => setDriverForm({...driverForm, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="driver@test.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">연락처</label>
                <input required type="tel" value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="010-1234-5678" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">차량 정보 (선택)</label>
                <input type="text" value={driverForm.vehicleInfo} onChange={e => setDriverForm({...driverForm, vehicleInfo: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="1톤 트럭 (서울12가 3456)" />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="w-full py-4 bg-primary-600 text-white font-bold rounded-xl shadow-lg hover:bg-primary-700 transition-colors"
                >
                  등록 완료하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{name: string, role: string} | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Tab State
  const [activeTab, setActiveTab] = useState<'requests' | 'profile'>('requests');

  // Profile State
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileDetailAddress, setProfileDetailAddress] = useState('');
  const [profileZipCode, setProfileZipCode] = useState('');
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

    fetchMyRequests(token, page);
    if (page === 1) fetchMyProfile(token);
  }, [navigate, page]);

  const fetchMyRequests = async (token: string, currentPage: number) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/requests/me?page=${currentPage}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data.requests);
      setTotalPages(res.data.totalPages || 1);
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
      setProfileAddress(res.data.user.address || '');
      setProfileDetailAddress(res.data.user.detailAddress || '');
      setProfileZipCode(res.data.user.zipCode || '');
    } catch (error) {
      console.error('내 정보 조회 에러:', error);
    }
  };

  const handleAddressSearch = () => {
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        if (!data.address.startsWith('경기')) {
          alert('현재는 경기도 지역만 수거 서비스를 제공하고 있습니다.');
          return;
        }
        setProfileAddress(data.address);
        setProfileZipCode(data.zonecode);
        // 상세 주소 초기화
        setProfileDetailAddress('');
      }
    }).open();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.patch(`${import.meta.env.VITE_API_URL}/auth/profile`, {
        name: profileName,
        phone: profilePhone,
        address: profileAddress,
        detailAddress: profileDetailAddress,
        zipCode: profileZipCode
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

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            reject(new Error('Canvas context error'));
          }
        };
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsDataURL(file);
    });
  };

  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, reqId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReqId(reqId);
    try {
      const base64Photo = await compressImage(file);
      const token = localStorage.getItem('auth_token');
      
      await axios.patch(`${import.meta.env.VITE_API_URL}/requests/${reqId}/customer-photo`, {
        customerPackedPhotoUrl: base64Photo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('포장 사진이 업로드되었습니다.');
      // 리스트 갱신
      fetchMyRequests(token || '', page);
    } catch (error) {
      console.error('사진 업로드 실패:', error);
      alert('사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingReqId(null);
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

                      {/* 고객 포장 사진 업로드 영역 */}
                      {req.status !== 'COMPLETED' && (
                        <div className="mt-4 border-t border-gray-100 pt-4">
                          <p className="text-sm font-bold text-gray-800 mb-2">포장 사진 등록 (선택)</p>
                          <p className="text-xs text-gray-500 mb-3">기사님이 물건을 쉽게 찾을 수 있도록 문 앞에 내놓은 사진을 올려주세요.</p>
                          
                          {req.customerPackedPhotoUrl ? (
                            <div className="relative inline-block">
                              <img src={req.customerPackedPhotoUrl} alt="포장 사진" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                              <label className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-1.5 rounded-full shadow-md cursor-pointer hover:bg-blue-700">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, req.id)} disabled={uploadingReqId === req.id} />
                              </label>
                            </div>
                          ) : (
                            <label className={`block w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:bg-gray-50 transition-colors ${uploadingReqId === req.id ? 'opacity-50 pointer-events-none' : ''}`}>
                              <span className="text-sm font-bold text-gray-500">
                                {uploadingReqId === req.id ? '업로드 중...' : '📷 사진 촬영 또는 앨범 선택'}
                              </span>
                              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, req.id)} disabled={uploadingReqId === req.id} />
                            </label>
                          )}
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

              {/* Pagination UI */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8 mb-4">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 disabled:opacity-50 font-bold hover:bg-gray-50 transition-colors"
                  >
                    이전
                  </button>
                  <span className="px-4 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-xl">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 disabled:opacity-50 font-bold hover:bg-gray-50 transition-colors"
                  >
                    다음
                  </button>
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">주소</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profileAddress}
                    readOnly
                    onClick={handleAddressSearch}
                    placeholder="주소 검색을 눌러주세요"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none cursor-pointer text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="px-6 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-colors whitespace-nowrap"
                  >
                    주소 검색
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">상세 주소</label>
                <input
                  type="text"
                  value={profileDetailAddress}
                  onChange={(e) => setProfileDetailAddress(e.target.value)}
                  placeholder="상세 주소를 입력하세요 (예: 101동 202호)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">주소를 저장해두면 다음 수거 신청 시 편리합니다.</p>
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

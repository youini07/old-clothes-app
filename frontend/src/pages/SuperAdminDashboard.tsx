import React, { useEffect, useState } from 'react';
import axios from 'axios';
import MapRegionSelector from '../components/MapRegionSelector';
import Spinner from '../components/Spinner';

interface Partner {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  isApproved: boolean;
  regions: { regionId: string; province: string; city: string; town?: string }[];
  useBizMessage: boolean;
}

export default function SuperAdminDashboard() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(!!localStorage.getItem('superadmin_token'));
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('superadmin_token'));
  const [deletingRegionId, setDeletingRegionId] = useState<string | null>(null);

  // 파트너 등록 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    businessName: '',
    province: '',
    city: '',
    dong: ''
  });

  // 권역 관리 모달 상태
  const [selectedPartnerForRegion, setSelectedPartnerForRegion] = useState<Partner | null>(null);
  const [newRegionData, setNewRegionData] = useState({ province: '', city: '', dong: '' });

  // 모니터링 탭 상태
  const [activeView, setActiveView] = useState<'partners' | 'monitoring'>('partners');
  const [monitoring, setMonitoring] = useState<any>(null);

  useEffect(() => {
    if (authToken) {
      fetchPartners();
      fetchMonitoring();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  async function fetchMonitoring() {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/monitoring`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setMonitoring(res.data);
    } catch (error) {
      console.error('모니터링 데이터 조회 실패:', error);
    }
  }

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/demo`, { role: 'SUPER_ADMIN' });
      const token = res.data.token;
      localStorage.setItem('superadmin_token', token);
      setAuthToken(token);
    } catch (error) {
      alert('데모 로그인 실패');
      setLoading(false);
    }
  };

  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return alert('로그인이 필요합니다.');
    
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/partners`, formData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('파트너 등록이 완료되었습니다.');
      setIsModalOpen(false);
      setFormData({ name: '', email: '', phone: '', businessName: '', province: '', city: '', dong: '' });
      fetchPartners();
    } catch (error) {
      console.error(error);
      alert('파트너 등록 중 오류가 발생했습니다.');
    }
  };

  const handleAddRegion = async () => {
    if (!authToken || !selectedPartnerForRegion) return;
    if (!newRegionData.province || !newRegionData.city) {
      return alert('추가할 권역을 선택해주세요.');
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/partners/${selectedPartnerForRegion.id}/coverage`, newRegionData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('권역이 추가되었습니다.');
      setNewRegionData({ province: '', city: '', dong: '' });
      // 낙관적 업데이트 생략 후 바로 fetch
      fetchPartners();
      
      // 모달에 보여줄 파트너 정보 갱신 (선택된 파트너를 업데이트된 정보로 변경)
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/partners`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const updatedPartners = res.data.partners;
      setPartners(updatedPartners);
      const updatedCurrent = updatedPartners.find((p: Partner) => p.id === selectedPartnerForRegion.id);
      if (updatedCurrent) setSelectedPartnerForRegion(updatedCurrent);

    } catch (error) {
      console.error(error);
      alert('권역 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteRegion = async (regionId: string) => {
    if (!authToken || !selectedPartnerForRegion) return;
    if (!window.confirm('해당 권역을 삭제하시겠습니까?')) return;
    setDeletingRegionId(regionId);

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/admin/partners/${selectedPartnerForRegion.id}/coverage/${regionId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('권역이 삭제되었습니다.');
      fetchPartners();

      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/partners`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const updatedPartners = res.data.partners;
      setPartners(updatedPartners);
      const updatedCurrent = updatedPartners.find((p: Partner) => p.id === selectedPartnerForRegion.id);
      if (updatedCurrent) setSelectedPartnerForRegion(updatedCurrent);

    } catch (error) {
      console.error(error);
      alert('권역 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingRegionId(null);
    }
  };

  async function fetchPartners() {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/partners`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setPartners(res.data.partners || []);
    } catch (error) {
      console.error('파트너 목록 조회 실패:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setAuthToken(null);
        localStorage.removeItem('superadmin_token');
      }
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }

  const approvePartner = async (partnerId: string) => {
    if (!authToken) return alert('로그인이 필요합니다.');
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/admin/partners/${partnerId}/approve`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('승인 완료되었습니다.');
      fetchPartners();
    } catch (error) {
      alert('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const toggleBizMessage = async (partnerId: string, currentState: boolean) => {
    if (!authToken) return alert('로그인이 필요합니다.');
    // Optimistic update for UI speed
    setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, useBizMessage: !currentState } : p));
    
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/admin/partners/${partnerId}/biz-message`, {
        useBizMessage: !currentState
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    } catch (error) {
      alert('설정 변경 중 오류가 발생했습니다.');
      fetchPartners(); // rollback
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="glass p-8 rounded-3xl flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              슈퍼 관리자 <span className="text-gradient">컨트롤 타워</span>
            </h1>
            <p className="text-gray-500 mt-2 font-medium">전국 가맹점(파트너) 승인 및 권역 할당 현황을 관리합니다.</p>
          </div>
          <div className="flex space-x-4 items-center">
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              className="flex items-center px-4 py-2 text-sm text-gray-500 bg-gray-100 font-bold rounded-xl hover:bg-gray-200 transition-all"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              로그아웃
            </button>
            <a href="https://docs.google.com/spreadsheets/d/1hOwdwvhPIq2QAGWMNsSWXQXWa6MFUOYsp3gM8rr6ImY/edit" target="_blank" rel="noopener noreferrer" className="hidden md:flex px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl text-sm border border-green-200 hover:bg-green-100 transition-colors items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              전체 수거현황 스프레드시트
            </a>
            {authToken && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-gray-800 transition-all active:scale-95"
              >
                파트너 등록하기
              </button>
            )}
            {!authToken && (
              <button 
                onClick={handleDemoLogin} 
                className="px-4 py-2 bg-yellow-400 text-yellow-900 font-bold rounded-xl shadow-md hover:bg-yellow-500 transition-all active:scale-95"
              >
                데모 로그인
              </button>
            )}
            <div className="hidden md:block bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-bold">
              총 가맹점: {partners.length}개
            </div>
          </div>
        </div>
        {/* 탭 전환 */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button onClick={() => setActiveView('partners')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'partners' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{'\uD83D\uDCCB'} 파트너 관리</button>
          <button onClick={() => setActiveView('monitoring')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'monitoring' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{'\uD83D\uDCCA'} 통합 모니터링</button>
        </div>

        {/* 모니터링 뷰 */}
        {activeView === 'monitoring' && monitoring && (
          <div className="space-y-6">
            {/* 기간별 현황 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
                <p className="text-sm opacity-80 font-medium">오늘</p>
                <p className="text-3xl font-extrabold mt-1">{monitoring.period.today}<span className="text-lg">건</span></p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
                <p className="text-sm opacity-80 font-medium">이번 주</p>
                <p className="text-3xl font-extrabold mt-1">{monitoring.period.thisWeek}<span className="text-lg">건</span></p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white">
                <p className="text-sm opacity-80 font-medium">이번 달</p>
                <p className="text-3xl font-extrabold mt-1">{monitoring.period.thisMonth}<span className="text-lg">건</span></p>
              </div>
            </div>

            {/* 전국 요약 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">전체 수거 건수</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{monitoring.overview.totalRequests}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">완료 건수</p>
                <p className="text-3xl font-extrabold text-green-600 mt-1">{monitoring.overview.completedCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">총 수거량</p>
                <p className="text-3xl font-extrabold text-blue-600 mt-1">{monitoring.overview.totalWeight}<span className="text-lg">kg</span></p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">파트너 수</p>
                <p className="text-3xl font-extrabold text-purple-600 mt-1">{monitoring.overview.partnerCount}<span className="text-lg">개</span></p>
              </div>
            </div>

            {/* 파트너별 성과 테이블 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900">파트너별 성과 현황</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500">파트너</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-gray-500">접수</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-gray-500">완료</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-gray-500">완료율</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-gray-500">무게(kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monitoring.partnerStats.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 text-sm font-bold text-gray-900">{p.name}</td>
                        <td className="px-5 py-4 text-sm text-center text-gray-600">{p.totalRequests}</td>
                        <td className="px-5 py-4 text-sm text-center font-bold text-green-600">{p.completedCount}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.completionRate >= 80 ? 'bg-green-100 text-green-700' : p.completionRate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{p.completionRate}%</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-center font-bold text-blue-600">{p.totalWeight}</td>
                      </tr>
                    ))}
                    {monitoring.partnerStats.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">등록된 파트너가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 월별 트렌드 차트 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">월별 수거 트렌드 (최근 6개월)</h3>
              <div className="space-y-3">
                {monitoring.monthlyTrend.map((m: any) => {
                  const maxCount = Math.max(...monitoring.monthlyTrend.map((s: any) => s.count), 1);
                  const barWidth = (m.count / maxCount) * 100;
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500 w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 flex items-center" style={{ width: `${Math.max(barWidth, 2)}%` }}>
                          {m.count > 0 && <span className="text-[10px] font-bold text-white ml-2 whitespace-nowrap">{m.count}건 / {m.weight}kg</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 파트너 관리 뷰 */}
        {activeView === 'partners' && <>
        {/* Partners List */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-800">파트너 승인 대기 목록</h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-gray-400 font-medium">로딩 중...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {partners.map(partner => (
                <div key={partner.id} className="p-6 border border-gray-100 rounded-2xl card-hover bg-white relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{partner.businessName}</h3>
                      <p className="text-sm text-gray-500">대표: {partner.ownerName} • {partner.phone}</p>
                    </div>
                    {partner.isApproved ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">승인 완료</span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">승인 대기</span>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">할당된 권역</p>
                      <button 
                        onClick={() => setSelectedPartnerForRegion(partner)}
                        className="text-xs font-bold text-primary-600 hover:text-primary-800 bg-primary-50 px-2 py-1 rounded-md"
                      >
                        권역 관리 ⚙️
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {partner.regions.length > 0 ? (
                        partner.regions.map((r, i) => (
                          <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                            {r.province} {r.city !== '전체' && r.city} {r.town && r.town !== '전체' && r.town}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">아직 할당된 권역이 없습니다.</span>
                      )}
                    </div>
                  </div>

                  {!partner.isApproved ? (
                    <button 
                      onClick={() => approvePartner(partner.id)}
                      className="mt-6 w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      승인 및 권역 할당하기
                    </button>
                  ) : (
                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
                      <div>
                        <p className="text-sm font-bold text-gray-800">알림톡 발송 <span className="text-primary-600 text-xs">(유료옵션)</span></p>
                        <p className="text-xs text-gray-500 mt-0.5">기사 출발 시 자동 전송</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={partner.useBizMessage}
                          onChange={() => toggleBizMessage(partner.id, partner.useBizMessage)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </>}

      </div>

      {/* Partner Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">신규 파트너 등록</h2>
            
            <form onSubmit={handleRegisterPartner} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">상호명</label>
                  <input required type="text" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="예: 강남 헌옷수거" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">대표자명</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="예: 홍길동" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">이메일 (로그인 ID 겸용)</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="example@email.com" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">연락처</label>
                <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="010-0000-0000" />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-800 mb-3">할당 권역 설정 (지도에서 선택)</p>
                <MapRegionSelector 
                  onRegionSelect={(info) => setFormData({...formData, province: info.province, city: info.city, dong: info.town})}
                />
                
                {/* 선택 결과 요약 표시 */}
                {formData.province && (
                  <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-xl text-sm font-semibold flex justify-between items-center">
                    <span>
                      선택됨: {formData.province} {formData.city && formData.city !== '전체' ? `> ${formData.city}` : ''} {formData.dong && formData.dong !== '전체' ? `> ${formData.dong}` : ''}
                    </span>
                    {(formData.province && formData.city && formData.dong) && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md">선택 완료</span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={!formData.province || !formData.city}
                  className={`w-full py-4 font-bold rounded-xl shadow-lg transition-colors
                    ${(!formData.province || !formData.city) 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' 
                      : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/30'
                    }
                  `}
                >
                  파트너 등록 완료하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Partner Region Management Modal */}
      {selectedPartnerForRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => {
                setSelectedPartnerForRegion(null);
                setNewRegionData({ province: '', city: '', dong: '' });
              }}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedPartnerForRegion.businessName} 권역 관리</h2>
            <p className="text-sm text-gray-500 mb-6">현재 할당된 권역을 삭제하거나, 새로운 권역을 추가할 수 있습니다.</p>

            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">현재 할당된 권역 리스트</h3>
              <div className="flex flex-wrap gap-2">
                {selectedPartnerForRegion.regions.length > 0 ? (
                  selectedPartnerForRegion.regions.map((r, i) => (
                    <div key={i} className="flex items-center bg-blue-50 text-blue-800 rounded-lg overflow-hidden border border-blue-100">
                      <span className="px-3 py-2 text-sm font-medium">
                        {r.province} {r.city !== '전체' && r.city} {r.town && r.town !== '전체' && r.town}
                      </span>
                      <button 
                        onClick={() => handleDeleteRegion(r.regionId)}
                        disabled={deletingRegionId === r.regionId}
                        className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1 disabled:opacity-50 px-3 py-2 bg-blue-100 transition-colors"
                      >
                        {deletingRegionId === r.regionId && <Spinner className="w-3 h-3 text-red-500" />}
                        {deletingRegionId === r.regionId ? '삭제중' : '✕'}
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-gray-400 italic">할당된 권역이 없습니다.</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">새로운 권역 추가하기</h3>
              <MapRegionSelector 
                onRegionSelect={(info) => setNewRegionData({ province: info.province, city: info.city, dong: info.town })}
              />
              
              {newRegionData.province && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">
                    추가할 지역: <span className="text-primary-600">{newRegionData.province} {newRegionData.city !== '전체' && newRegionData.city} {newRegionData.dong !== '전체' && newRegionData.dong}</span>
                  </span>
                  <button 
                    onClick={handleAddRegion}
                    disabled={!newRegionData.province || !newRegionData.city}
                    className={`px-4 py-2 font-bold rounded-lg transition-colors
                      ${(!newRegionData.province || !newRegionData.city) 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md'
                      }
                    `}
                  >
                    추가하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

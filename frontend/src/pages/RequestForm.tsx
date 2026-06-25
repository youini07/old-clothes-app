import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export default function RequestForm() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [estimatedVolume, setEstimatedVolume] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [regionInfo, setRegionInfo] = useState({ province: '', city: '', town: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.data.user.name) setUserName(res.data.user.name);
        if (res.data.user.phone) setPhone(res.data.user.phone);
        if (res.data.user.address) setAddress(res.data.user.address);
        if (res.data.user.detailAddress) setDetailAddress(res.data.user.detailAddress);
        if (res.data.user.zipCode) setZipCode(res.data.user.zipCode);
      })
      .catch(err => console.error('사용자 정보 불러오기 실패:', err));
    }
  }, []);

  const handleAddressSearch = () => {
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        if (!data.address.startsWith('경기')) {
          alert('현재는 경기도 지역만 수거 서비스를 제공하고 있습니다.');
          return;
        }
        setAddress(data.address);
        setZipCode(data.zonecode);
        
        // 백엔드 권역 매칭을 위한 상세 행정구역 데이터
        let provinceName = data.sido;
        if (provinceName === '경기') provinceName = '경기도'; // DB 포맷 통일
        
        setRegionInfo({
          province: provinceName,
          city: data.sigungu,
          town: data.bname || data.bname1 || ''
        });
      }
    }).open();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // 중복 제출 방지
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/requests`, {
        userName,
        phone,
        address,
        detailAddress,
        zipCode: zipCode || '00000',
        desiredDate,
        estimatedVolume: estimatedWeight ? `${estimatedWeight}kg - ${estimatedVolume}` : estimatedVolume,
        regionInfo
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      alert(response.data.message || '수거 신청이 완료되었습니다!');
      window.location.href = '/status';
    } catch (error) {
      console.error(error);
      alert('신청 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsLoading(false); // 에러 발생 시에만 로딩 해제 (성공 시 페이지 이동하므로 유지)
    }
  };

  return (
    <>
      {/* 로딩 오버레이 (Glassmorphism & Spinner) */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm transition-opacity">
          <div className="flex flex-col items-center p-8 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-300">
            <Loader2 className="w-14 h-14 text-blue-600 animate-spin mb-5" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">수거 접수 중...</h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              고객님의 정보를 안전하게 저장하고<br/>최적의 수거 기사님을 찾고 있습니다.
            </p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 p-4 pb-20">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6 space-y-8">
        <div>
          <button
            onClick={() => navigate('/status')}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            대시보드로 돌아가기
          </button>
          <h2 className="text-2xl font-bold text-gray-900">헌옷 수거 신청</h2>
          <p className="text-sm text-gray-500 mt-1">방문하실 주소와 희망 일정을 입력해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 신청인 정보 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">이름</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">연락처</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* 주소 입력부 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">방문 주소</label>
            <div className="flex space-x-2">
              <input
                type="text"
                readOnly
                value={zipCode}
                placeholder="우편번호"
                className="w-1/3 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddressSearch}
                className="w-2/3 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700"
              >
                주소 찾기
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={address}
              placeholder="기본 주소"
              className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none"
            />
            <input
              type="text"
              value={detailAddress}
              onChange={(e) => setDetailAddress(e.target.value)}
              placeholder="상세 주소를 입력해주세요"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* 예상 물품량 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">대략적인 헌옷 무게 (kg)</label>
            <input
              type="number"
              value={estimatedWeight}
              onChange={(e) => setEstimatedWeight(e.target.value)}
              placeholder="예: 20 (숫자만 입력)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
            <label className="block text-sm font-medium text-gray-700 mt-2">상세 품목 메모 (선택)</label>
            <textarea
              value={estimatedVolume}
              onChange={(e) => setEstimatedVolume(e.target.value)}
              placeholder="예: 헌옷 외 신발 2켤레, 가방 1개 등 추가 메모"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none h-20 resize-none"
            ></textarea>
          </div>

          {/* 희망 날짜 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">수거 희망일</label>
            <input
              type="date"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center items-center gap-2 py-4 text-lg font-bold text-white rounded-xl shadow-lg transition-all ${
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? '신청 처리 중...' : '신청 완료하기'}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}

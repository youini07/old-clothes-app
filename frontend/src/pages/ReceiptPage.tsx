import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface CollectionItem {
  id: string;
  category: string;
  categoryLabel: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  subtotal: number;
}

interface ReceiptData {
  id: string;
  userName: string;
  address: string;
  actualWeight: number | null;
  totalPrice: number | null;
  itemPhotoUrl: string | null;
  scalePhotoUrl: string | null;
  extraPhotoUrl: string | null;
  completedDate: string | null;
  collectionItems: CollectionItem[];
  status: string;
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/requests/${id}/receipt`);
        setReceipt(res.data);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error || '영수증을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchReceipt();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 font-medium">영수증 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="text-6xl mb-4">📄</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">영수증을 찾을 수 없습니다</h2>
        <p className="text-gray-500 text-center">{error}</p>
      </div>
    );
  }

  // 개인정보 보호용 마스킹 처리 (이름 가운데 글자 등)
  const maskName = (name: string) => {
    if (!name || name.length < 2) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  // 주소에서 상세주소(동/호수) 제거하고 앞부분만 표시 (공백 3개 정도까지만)
  const maskAddress = (address: string) => {
    if (!address) return '';
    const parts = address.split(' ');
    return parts.slice(0, 3).join(' ') + ' ...';
  };

  const hasPhotos = receipt.itemPhotoUrl || receipt.scalePhotoUrl || receipt.extraPhotoUrl;

  return (
    <div className="min-h-[100dvh] bg-gray-100 flex flex-col items-center py-8 px-4 font-sans selection:bg-blue-100">
      
      {/* 영수증 컨테이너 */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg overflow-hidden animate-fade-in">
        
        {/* 상단 완료 뱃지 및 로고 영역 */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white relative">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">수거 완료</h1>
          <p className="text-blue-100 font-medium opacity-90 text-sm">
            {receipt.completedDate ? new Date(receipt.completedDate).toLocaleString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '완료 일시 정보 없음'}
          </p>
        </div>

        {/* 고객 정보 요약 */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-500 text-sm font-bold">고객명</span>
            <span className="text-gray-900 font-extrabold">{maskName(receipt.userName)} 님</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm font-bold">수거지</span>
            <span className="text-gray-700 font-medium text-sm text-right">{maskAddress(receipt.address)}</span>
          </div>
        </div>

        {/* 메인 정산 금액 (크게 강조) */}
        <div className="p-8 text-center border-b border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-2">최종 정산 금액</p>
          <div className="text-5xl font-extrabold text-blue-600 tracking-tighter">
            {(receipt.totalPrice || 0).toLocaleString()}<span className="text-2xl ml-1 text-gray-900">원</span>
          </div>
        </div>

        {/* 항목별 상세 내역 */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📋</span> 정산 상세 내역
          </h3>
          
          {receipt.collectionItems && receipt.collectionItems.length > 0 ? (
            <div className="space-y-3">
              {receipt.collectionItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 font-medium">{item.categoryLabel}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-bold">
                      {item.quantity}{item.unitType === 'KG' ? 'kg' : '대'}
                    </span>
                  </div>
                  <div className="font-bold text-gray-900">
                    {item.subtotal.toLocaleString()}원
                  </div>
                </div>
              ))}
              <div className="pt-3 mt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                <span className="text-gray-500 font-bold">총 합계</span>
                <span className="font-extrabold text-lg text-blue-600">{(receipt.totalPrice || 0).toLocaleString()}원</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700 font-medium">단일 무게 정산</span>
              <span className="text-gray-900 font-bold">{receipt.actualWeight}kg</span>
            </div>
          )}
        </div>

        {/* 수거 증빙 사진 갤러리 */}
        {hasPhotos && (
          <div className="p-6 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>📷</span> 수거 증빙 사진
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {receipt.scalePhotoUrl && (
                <div className="relative group rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
                    ⚖️ 저울 무게 사진
                  </div>
                  <img src={receipt.scalePhotoUrl} alt="저울 사진" className="w-full h-auto object-cover" />
                </div>
              )}
              
              {receipt.itemPhotoUrl && (
                <div className="relative group rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
                    📦 수거 물품 사진
                  </div>
                  <img src={receipt.itemPhotoUrl} alt="물품 사진" className="w-full h-auto object-cover" />
                </div>
              )}

              {receipt.extraPhotoUrl && (
                <div className="relative group rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
                    📝 특이사항 사진
                  </div>
                  <img src={receipt.extraPhotoUrl} alt="특이사항 사진" className="w-full h-auto object-cover" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 푸터 영역 */}
        <div className="p-6 bg-gray-900 text-center text-gray-400 text-xs">
          <p className="font-medium mb-1">올클(ALL-CLEAR) 헌옷 수거 서비스를 이용해 주셔서 감사합니다.</p>
          <p>이 영수증 페이지는 알림톡(문자) 수신자 본인만 확인할 수 있습니다.</p>
        </div>
      </div>
      
    </div>
  );
}

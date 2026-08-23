import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Megaphone, X } from 'lucide-react';

export default function GlobalNoticeBanner() {
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchNotice = () => {
      axios.get(`${import.meta.env.VITE_API_URL}/public/global-settings`)
        .then(res => {
          if (res.data?.noticeIsActive && res.data?.globalNotice) {
            // 줄바꿈 문자를 공백으로 치환하여 무조건 한 줄로 보이게 처리
            setNotice(res.data.globalNotice.replace(/\n/g, ' '));
            setDetail(res.data.globalNoticeDetail || null);
            
            const currentHash = res.data.globalNotice + (res.data.globalNoticeDetail || '');
            const dismissedHash = sessionStorage.getItem('dismissed_notice_hash');
            if (dismissedHash === currentHash) {
              setIsVisible(false);
            } else {
              setIsVisible(true);
            }
          } else {
            setNotice(null);
            setDetail(null);
            setIsVisible(false);
          }
        })
        .catch(err => console.error('공지사항 불러오기 실패:', err));
    };

    fetchNotice();

    const handleUpdate = () => {
      fetchNotice();
    };
    window.addEventListener('globalNoticeUpdated', handleUpdate);
    
    return () => {
      window.removeEventListener('globalNoticeUpdated', handleUpdate);
    };
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening the modal
    setIsVisible(false);
    if (notice) {
      sessionStorage.setItem('dismissed_notice_hash', notice + (detail || ''));
    }
  };

  const handleClickBanner = () => {
    if (detail) {
      setIsModalOpen(true);
    }
  };

  if (!notice || !isVisible) return null;

  return (
    <>
      <div 
        onClick={handleClickBanner}
        className={`bg-gradient-to-r from-indigo-600 to-blue-600 text-white relative shadow-md z-40 ${detail ? 'cursor-pointer hover:from-indigo-700 hover:to-blue-700 transition-colors' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap">
            <div className="w-0 flex-1 flex items-center min-w-0">
              <span className="flex p-2 rounded-lg bg-indigo-800 bg-opacity-50 shrink-0">
                <Megaphone className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <p className="ml-3 font-medium text-sm md:text-base whitespace-nowrap truncate flex items-center">
                {notice}
                {detail && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 shrink-0">자세히 보기</span>}
              </p>
            </div>
            <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3 shrink-0">
              <button
                type="button"
                onClick={handleDismiss}
                className="-mr-1 flex p-2 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2 transition-colors"
              >
                <span className="sr-only">닫기</span>
                <X className="h-5 w-5 text-white" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col z-10 m-4 sm:m-8">
            
            {/* 모달 헤더 (아이콘 + 제목) */}
            <div className="px-5 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-5 shrink-0 flex items-center gap-3 border-b border-gray-100">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-indigo-50 border border-indigo-100">
                <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" aria-hidden="true" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight" id="modal-title">
                공지사항 상세 내용
              </h3>
            </div>
            
            {/* 모달 본문 (텍스트 영역 전체 폭 활용) */}
            <div className="px-5 sm:px-8 py-6 overflow-y-auto flex-1">
              <div className="bg-gray-50 p-5 sm:p-7 rounded-xl border border-gray-100">
                <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed break-keep">
                  {detail}
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="bg-white px-5 py-4 sm:px-8 sm:flex sm:flex-row-reverse rounded-b-xl shrink-0 border-t border-gray-100">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => setIsModalOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

import { useState, useEffect } from 'react';
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
            setNotice(res.data.globalNotice);
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
            <div className="w-0 flex-1 flex items-center">
              <span className="flex p-2 rounded-lg bg-indigo-800 bg-opacity-50">
                <Megaphone className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <p className="ml-3 font-medium text-sm md:text-base whitespace-pre-wrap flex items-center">
                {notice}
                {detail && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">자세히 보기</span>}
              </p>
            </div>
            <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col z-10">
            <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 overflow-y-auto">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Megaphone className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    공지사항 상세 내용
                  </h3>
                  <div className="mt-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md border border-gray-100">
                      {detail}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg shrink-0">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => setIsModalOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

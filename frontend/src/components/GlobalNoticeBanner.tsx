import { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, X } from 'lucide-react';

export default function GlobalNoticeBanner() {
  const [notice, setNotice] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const fetchNotice = () => {
      axios.get(`${import.meta.env.VITE_API_URL}/public/global-settings`)
        .then(res => {
          if (res.data?.noticeIsActive && res.data?.globalNotice) {
            setNotice(res.data.globalNotice);
            
            // Check if THIS EXACT notice was dismissed
            const dismissedNoticeText = sessionStorage.getItem('dismissed_notice_text');
            if (dismissedNoticeText === res.data.globalNotice) {
              setIsVisible(false);
            } else {
              setIsVisible(true);
            }
          } else {
            setNotice(null);
            setIsVisible(false);
          }
        })
        .catch(err => console.error('공지사항 불러오기 실패:', err));
    };

    fetchNotice();

    // Listen for instant updates from Admin Dashboard
    const handleUpdate = () => {
      fetchNotice();
    };
    window.addEventListener('globalNoticeUpdated', handleUpdate);
    
    return () => {
      window.removeEventListener('globalNoticeUpdated', handleUpdate);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    if (notice) {
      sessionStorage.setItem('dismissed_notice_text', notice);
    }
  };

  if (!notice || !isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white relative shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-indigo-800 bg-opacity-50">
              <Megaphone className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <p className="ml-3 font-medium text-sm md:text-base whitespace-pre-wrap">
              {notice}
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
  );
}

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function GlobalPopupBanner() {
  const [popupImageUrl, setPopupImageUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Only show on the homepage (Landing page)
    if (location.pathname !== '/') return;

    const fetchPopup = () => {
      axios.get(`${import.meta.env.VITE_API_URL}/public/global-settings`)
        .then(res => {
          if (res.data?.popupIsActive && res.data?.popupImageUrl) {
            setPopupImageUrl(res.data.popupImageUrl);
            
            // Check cookie or localStorage for "Do not show for a week"
            const hideUntil = localStorage.getItem('hide_popup_until');
            if (hideUntil && new Date().getTime() < parseInt(hideUntil)) {
              setIsVisible(false);
            } else {
              setIsVisible(true);
            }
          } else {
            setPopupImageUrl(null);
            setIsVisible(false);
          }
        })
        .catch(err => console.error('팝업 설정 불러오기 실패:', err));
    };

    fetchPopup();
  }, [location.pathname]);

  const handleClose = () => {
    setIsVisible(false);
  };

  const handleHideForAWeek = () => {
    const oneWeekFromNow = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('hide_popup_until', oneWeekFromNow.toString());
    setIsVisible(false);
  };

  if (!isVisible || !popupImageUrl) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={handleClose}></div>
      
      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 m-4 sm:m-8 w-full max-w-sm sm:max-w-md">
        
        {/* Popup Image */}
        <a href="#event" onClick={handleClose} className="relative w-full h-auto cursor-pointer block group">
          <img src={popupImageUrl} alt="팝업 배너" className="w-full h-auto block object-cover group-hover:opacity-95 transition-opacity" />
        </a>


        {/* Action Buttons */}
        <div className="bg-gray-50 flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-900">
            <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" onChange={handleHideForAWeek} />
            일주일 동안 보지 않기
          </label>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none flex items-center gap-1"
          >
            닫기
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

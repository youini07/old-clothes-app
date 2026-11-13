import { useEffect, useRef, useState } from 'react';
import { loadPostcodeConstructor } from '../utils/postcode';

interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

export default function AddressSearchModal({ isOpen, onClose, onComplete }: AddressSearchModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onCompleteRef = useRef(onComplete);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 왜 ref로 콜백을 보관하는가: 부모가 인라인 화살표 함수를 넘겨 리렌더될 때마다 우편번호 iframe이 재임베드되는 것을 막기 위함
  useEffect(() => {
    onCloseRef.current = onClose;
    onCompleteRef.current = onComplete;
  }, [onClose, onComplete]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    setLoadError(null);

    loadPostcodeConstructor()
      .then((Postcode) => {
        if (isCancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        new Postcode({
          oncomplete: (data: any) => {
            onCompleteRef.current(data);
            onCloseRef.current();
          },
          width: '100%',
          height: '100%',
        }).embed(containerRef.current);
      })
      .catch((error) => {
        console.error('주소 검색 로드 실패:', error);
        if (!isCancelled) {
          setLoadError('주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-md flex flex-col" style={{ height: '80vh' }}>
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
          <h3 className="font-bold">주소 검색</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 w-8 h-8 flex justify-center items-center rounded-lg">
            ✕
          </button>
        </div>
        {loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-sm text-gray-600 gap-3">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg font-bold text-xs"
            >
              닫기
            </button>
          </div>
        ) : (
          <div ref={containerRef} className="flex-1 w-full relative" />
        )}
      </div>
    </div>
  );
}

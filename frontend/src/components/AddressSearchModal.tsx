import { useEffect, useRef } from 'react';

interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

export default function AddressSearchModal({ isOpen, onClose, onComplete }: AddressSearchModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && (window as any).daum && (window as any).daum.Postcode && containerRef.current) {
      new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          onComplete(data);
          onClose();
        },
        width: '100%',
        height: '100%',
      }).embed(containerRef.current);
    }
  }, [isOpen, onClose, onComplete]);

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
        <div ref={containerRef} className="flex-1 w-full relative" />
      </div>
    </div>
  );
}

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Trash2, ChevronLeft, ChevronRight, ZoomIn, X, Gift } from 'lucide-react';
import { compressEventProofImage, MAX_EVENT_PROOF_IMAGES } from '../utils/imageCompress';

interface EventProofManagerProps {
  title: string;
  images: string[];
  onChangeTitle: (title: string) => void;
  onChangeImages: (images: string[]) => void;
  onSave: () => void;
  isSaving: boolean;
}

/**
 * 관리자 환경설정용 '치킨 이벤트 당첨자 기프티콘 전송 인증샷' 관리 카드
 * 왜 별도 컴포넌트로 분리하는가:
 * - AdminDashboard.tsx 파일 비대화를 방지하고, 다중 이미지 압축·드래그앤드롭·순서 변경·미리보기 로직을
 *   독립적으로 유지보수하기 위함입니다.
 */
export default function EventProofManager({
  title,
  images,
  onChangeTitle,
  onChangeImages,
  onSave,
  isSaving
}: EventProofManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [compressProgress, setCompressProgress] = useState<{ current: number; total: number } | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = MAX_EVENT_PROOF_IMAGES - images.length;
    if (remainingSlots <= 0) {
      alert(`인증샷은 최대 ${MAX_EVENT_PROOF_IMAGES}장까지 등록할 수 있습니다. 기존 이미지를 삭제한 뒤 추가해주세요.`);
      return;
    }

    const selectedFiles = Array.from(fileList);
    const filesToProcess = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      alert(`최대 ${MAX_EVENT_PROOF_IMAGES}장까지만 등록 가능하여 앞의 ${remainingSlots}장만 첨부합니다.`);
    }

    const compressedList: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      setCompressProgress({ current: i + 1, total: filesToProcess.length });
      try {
        const compressed = await compressEventProofImage(filesToProcess[i]);
        compressedList.push(compressed);
      } catch (err: any) {
        errors.push(`${filesToProcess[i].name}: ${err?.message || '이미지 처리 실패'}`);
      }
    }

    setCompressProgress(null);

    if (compressedList.length > 0) {
      onChangeImages([...images, ...compressedList]);
    }
    if (errors.length > 0) {
      alert(`일부 이미지를 첨부하지 못했습니다:\n${errors.join('\n')}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(e.target.files);
    // 같은 파일을 삭제 후 재선택해도 onChange가 다시 동작하도록 초기화
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const handleRemoveImage = (idx: number) => {
    onChangeImages(images.filter((_, i) => i !== idx));
    if (previewIndex !== null) {
      if (previewIndex === idx) setPreviewIndex(null);
      else if (previewIndex > idx) setPreviewIndex(previewIndex - 1);
    }
  };

  const handleMoveImage = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const next = [...images];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    onChangeImages(next);
  };

  const handleClearAll = () => {
    if (images.length === 0) return;
    if (window.confirm('등록된 당첨자 인증샷을 모두 삭제하시겠습니까?')) {
      onChangeImages([]);
      setPreviewIndex(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      {/* 카드 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-gray-900">🍗 치킨 기프티콘 당첨자 인증샷</h4>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
              images.length > 0
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {images.length > 0 ? `${images.length} / ${MAX_EVENT_PROOF_IMAGES}장 등록됨` : '미등록'}
          </span>
          {images.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              전체 삭제
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        지난달 당첨자분들께 치킨 기프티콘을 전송한 인증 스크린샷을 첨부하면 홈페이지 <strong>진행중인 이벤트</strong> 영역에 예쁘게 노출됩니다.
      </p>

      <div className="space-y-4">
        {/* 인증샷 섹션 제목 (선택) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            인증샷 안내 제목 <span className="text-xs font-normal text-gray-400">(선택 · 비워두면 기본 문구 노출)</span>
          </label>
          <input
            type="text"
            maxLength={60}
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="예: 10월 리뷰 당첨자 치킨 기프티콘 발송 완료!"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none text-gray-800 text-sm transition-shadow"
          />
        </div>

        {/* 다중 이미지 드래그 & 드롭 첨부 영역 */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={() => !compressProgress && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-amber-500 bg-amber-50/80 scale-[0.99]'
                : 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/60 hover:border-amber-400'
            } ${images.length >= MAX_EVENT_PROOF_IMAGES ? 'opacity-60' : ''}`}
          >
            {compressProgress ? (
              <div className="py-2 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-amber-800">
                  이미지 최적화 중... ({compressProgress.current} / {compressProgress.total})
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-gray-800">
                  클릭하거나 인증샷 이미지를 끌어다 놓으세요
                </p>
                <p className="text-xs text-gray-500">
                  여러 장 동시 첨부 가능 · 최대 {MAX_EVENT_PROOF_IMAGES}장 · 자동 용량 최적화
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 첨부된 인증샷 미리보기 & 순서/삭제 관리 그리드 */}
        {images.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">
              첨부된 인증샷 미리보기 (좌우 버튼으로 노출 순서 변경 가능)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((src, idx) => (
                <div
                  key={`${idx}-${src.slice(-16)}`}
                  className="group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm"
                >
                  {/* 썸네일 영역 */}
                  <div
                    onClick={() => setPreviewIndex(idx)}
                    className="aspect-[3/4] w-full overflow-hidden cursor-zoom-in relative bg-gray-100"
                  >
                    <img
                      src={src}
                      alt={`당첨자 기프티콘 인증샷 ${idx + 1}`}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-bold flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5" /> 크게 보기
                      </span>
                    </div>
                  </div>

                  {/* 순서 배지 */}
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm ${
                      idx === 0
                        ? 'bg-amber-500 text-white'
                        : 'bg-black/65 text-white'
                    }`}
                  >
                    {idx === 0 ? '#1 대표' : `#${idx + 1}`}
                  </span>

                  {/* 개별 삭제 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    title="이미지 삭제"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* 순서 이동 컨트롤 */}
                  {images.length > 1 && (
                    <div className="flex items-center justify-between px-2 py-1.5 bg-white border-t border-gray-100">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveImage(idx, -1)}
                        className="p-1 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="앞으로 이동"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] font-bold text-gray-500">
                        {idx + 1} / {images.length}
                      </span>
                      <button
                        type="button"
                        disabled={idx === images.length - 1}
                        onClick={() => handleMoveImage(idx, 1)}
                        className="p-1 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="뒤로 이동"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 저장 안내 및 즉시 저장 버튼 */}
        <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            첨부/수정 후 저장 버튼을 누르셔야 홈페이지 이벤트란에 즉시 반영됩니다.
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || Boolean(compressProgress)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors shrink-0"
          >
            {isSaving ? '저장 중...' : '인증샷 설정 저장하기'}
          </button>
        </div>
      </div>

      {/* 관리자 확대 미리보기 모달 */}
      {previewIndex !== null && images[previewIndex] && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewIndex(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white mb-3 px-1">
              <span className="text-sm font-bold">
                인증샷 미리보기 ({previewIndex + 1} / {images.length})
              </span>
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={images[previewIndex]}
              alt={`미리보기 ${previewIndex + 1}`}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl bg-white"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

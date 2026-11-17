import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Trash2, ChevronLeft, ChevronRight, ZoomIn, X, Gift, Save } from 'lucide-react';
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
 *
 * [왜 다른 설정 카드들과 동일한 Slate/Blue 디자인 토큰으로 통일했는가]
 * 기존에는 이 카드만 노란 점선·주황 버튼·거대한 2열 세로 썸네일을 사용해 설정 화면 전체의 균형을 깨뜨렸으므로,
 * 컴팩트한 3~4열 썸네일 그리드와 일관된 카드 규격으로 정돈하여 우측 열 안에서 한눈에 들어오도록 개선했습니다.
 */
export default function EventProofManager({
  title,
  images,
  onChangeTitle,
  onChangeImages,
  onSave,
  isSaving,
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
    <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
      {/* 카드 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-blue-600 shrink-0" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            치킨 기프티콘 당첨자 인증샷
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
              images.length > 0
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {images.length > 0 ? `${images.length} / ${MAX_EVENT_PROOF_IMAGES}장` : '미등록'}
          </span>
          {images.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-red-600 bg-white hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
            >
              전체 삭제
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        지난달 당첨자 기프티콘 발송 스크린샷을 등록하면 홈페이지 이벤트 영역에 함께 표시됩니다.
      </p>

      {/* 인증샷 섹션 제목 (선택) */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          인증샷 안내 제목 <span className="font-normal text-slate-400">(선택)</span>
        </label>
        <input
          type="text"
          maxLength={60}
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="예: 지난달 리뷰 당첨자 치킨 기프티콘 발송 완료!"
          className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl focus:border-blue-600 outline-none text-slate-900 text-sm transition-colors"
        />
      </div>

      {/* 다중 이미지 드래그 & 드롭 첨부 영역 (컴팩트 높이) */}
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
          className={`border border-dashed rounded-xl px-4 py-3.5 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50/70'
              : 'border-slate-300 bg-slate-50/70 hover:bg-slate-100/70 hover:border-slate-400'
          } ${images.length >= MAX_EVENT_PROOF_IMAGES ? 'opacity-60' : ''}`}
        >
          {compressProgress ? (
            <div className="py-1 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-blue-700">
                이미지 최적화 중... ({compressProgress.current} / {compressProgress.total})
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">
                  클릭하거나 인증샷 이미지를 끌어다 놓으세요
                </p>
                <p className="text-[11px] text-slate-500">
                  여러 장 동시 첨부 · 최대 {MAX_EVENT_PROOF_IMAGES}장 자동 최적화
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 첨부된 인증샷 미리보기 & 순서/삭제 관리 그리드 (3~4열 컴팩트 카드) */}
      {images.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 mb-2">
            첨부된 인증샷 (클릭 시 확대 · 화살표로 순서 변경)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {images.map((src, idx) => (
              <div
                key={`${idx}-${src.slice(-16)}`}
                className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
              >
                <div
                  onClick={() => setPreviewIndex(idx)}
                  className="aspect-[3/4] w-full overflow-hidden cursor-zoom-in relative bg-slate-100"
                >
                  <img
                    src={src}
                    alt={`당첨자 기프티콘 인증샷 ${idx + 1}`}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <span
                  className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-xs ${
                    idx === 0 ? 'bg-blue-600 text-white' : 'bg-black/65 text-white'
                  }`}
                >
                  {idx === 0 ? '대표' : `#${idx + 1}`}
                </span>

                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  title="이미지 삭제"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {images.length > 1 && (
                  <div className="flex items-center justify-between px-1.5 py-1 bg-white border-t border-slate-100">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveImage(idx, -1)}
                      className="p-0.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                      {idx + 1}/{images.length}
                    </span>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => handleMoveImage(idx, 1)}
                      className="p-0.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 즉시 반영 보조 저장 바 */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">
          이미지 변경 후 저장 버튼을 눌러 반영하세요.
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || Boolean(compressProgress)}
          className="h-8 px-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? '저장 중...' : '인증샷 저장'}</span>
        </button>
      </div>

      {/* 확대 미리보기 모달 */}
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
    </section>
  );
}

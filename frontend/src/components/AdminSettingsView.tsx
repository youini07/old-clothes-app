import React, { useState } from 'react';
import {
  Bell,
  Image as ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  MessageSquareText,
  Phone,
  Plus,
  Save,
  Scale,
  Smartphone,
  Trash2,
  Upload,
  UserPlus,
  Video,
} from 'lucide-react';
import EventProofManager from './EventProofManager';
import InstallProgramManualSection from './InstallProgramManualSection';
import PwaInstallButton from './PwaInstallButton';
import { compressEventProofImage } from '../utils/imageCompress';

export interface PartnerSettingsData {
  pricePerKg: number;
  useBizMessage: boolean;
  useCrmAutomation: boolean;
  useChat?: boolean;
  eventText?: string;
  eventIsActive?: boolean;
}

export interface GlobalSettingsData {
  globalNotice: string;
  noticeIsActive: boolean;
  globalNoticeDetail?: string;
  popupImageUrl?: string | null;
  popupIsActive?: boolean;
  eventYoutubeUrl?: string | null;
  eventProofTitle?: string | null;
  eventProofImages?: string[];
  representativePhone?: string | null;
}

export interface PriceTableItemData {
  category: string;
  label: string;
  unitPrice: number;
  unitType: string;
  icon: string;
}

export interface CustomRegionData {
  id: string;
  name: string;
  areas: string[];
}

interface AdminSettingsViewProps {
  settings: PartnerSettingsData;
  setSettings: React.Dispatch<React.SetStateAction<PartnerSettingsData | null>>;
  globalSettings: GlobalSettingsData | null;
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettingsData | null>>;
  isSavingSettings: boolean;
  onSaveSettings: (e?: React.FormEvent) => void;
  priceTableItems: PriceTableItemData[];
  onOpenPriceTableModal: () => void;
  customRegions: CustomRegionData[];
  areaOptions: string[];
  newRegionForm: { name: string; selectedAreas: string[]; exceptions: Record<string, string> };
  setNewRegionForm: React.Dispatch<
    React.SetStateAction<{ name: string; selectedAreas: string[]; exceptions: Record<string, string> }>
  >;
  isAddingRegion: boolean;
  setIsAddingRegion: (v: boolean) => void;
  isSubmittingRegion: boolean;
  deletingRegionId: string | null;
  onAddRegion: (e: React.FormEvent) => void;
  onDeleteRegion: (id: string) => void;
  onToggleArea: (area: string) => void;
  onExceptionChange: (area: string, val: string) => void;
  onOpenDriverModal: () => void;
  onOpenPasswordModal: () => void;
  onOpenSmsAutoModal: () => void;
}

type SettingsCategoryTab = 'OPS' | 'HOMEPAGE' | 'APP_SMS';

/**
 * 왜 단일 스위치 디자인(SettingToggle)으로 통일했는가:
 * 기존 설정 화면은 보라색·주황색·노란색 토글과 테두리가 혼재되어 시각적 피로도가 높았으므로,
 * 모든 활성 상태를 단일 브랜드 블루(#2563EB)와 정돈된 슬레이트 중립 톤으로 일원화했습니다.
 */
const SettingToggle: React.FC<{
  checked: boolean;
  onToggle: () => void;
  label: string;
}> = ({ checked, onToggle, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer ${
      checked ? 'bg-blue-600' : 'bg-slate-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

/**
 * 올클 사장님 환경 설정 통합 뷰
 *
 * [리팩토링 핵심 의도]
 * 1) 기존에는 성격이 전혀 다른 10개의 카드가 좌측에만 7단으로 쏠리고 우측 80%가 빈 공간으로 남아 가독성이 무너졌으므로,
 *    실제 업무 목적별 3개 카테고리 탭([수거 운영 · 단가] / [홈페이지 공지 · 이벤트] / [앱 설치 · 문자접수])으로 분리했습니다.
 * 2) 모든 탭 내부를 좌·우 높이가 균형 잡힌 대칭 2열 그리드로 배치해 긴 스크롤 없이 한 화면에서 즉시 조작·저장할 수 있게 했습니다.
 */
export default function AdminSettingsView({
  settings,
  setSettings,
  globalSettings,
  setGlobalSettings,
  isSavingSettings,
  onSaveSettings,
  priceTableItems,
  onOpenPriceTableModal,
  customRegions,
  areaOptions,
  newRegionForm,
  setNewRegionForm,
  isAddingRegion,
  setIsAddingRegion,
  isSubmittingRegion,
  deletingRegionId,
  onAddRegion,
  onDeleteRegion,
  onToggleArea,
  onExceptionChange,
  onOpenDriverModal,
  onOpenPasswordModal,
  onOpenSmsAutoModal,
}: AdminSettingsViewProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryTab>('OPS');
  const [isUploadingPopup, setIsUploadingPopup] = useState(false);

  const handleSelectPopupImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !globalSettings) return;

    setIsUploadingPopup(true);
    try {
      const compressedDataUrl = await compressEventProofImage(file);
      setGlobalSettings({
        ...globalSettings,
        popupImageUrl: compressedDataUrl,
        popupIsActive: true,
      });
    } catch (err: any) {
      alert(err?.message || '팝업 이미지를 처리하는 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingPopup(false);
    }
  };

  const hasActiveRepPhone = Boolean(globalSettings?.representativePhone?.trim());

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* 상단 통합 컨트롤 헤더 (제목 + 카테고리 서브탭 + 변경사항 저장 버튼) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              운영 및 홈페이지 설정
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              수거 단가·권역부터 홈페이지 공지·이벤트, 사무실 문자 자동접수까지 카테고리별로 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSaveSettings()}
            disabled={isSavingSettings}
            className="h-10 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingSettings ? '저장 중...' : '변경사항 저장'}</span>
          </button>
        </div>

        {/* 3분할 카테고리 서브탭 */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveCategory('OPS')}
            className={`h-9 px-2 rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeCategory === 'OPS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-blue-600 shrink-0 hidden sm:inline" />
            <span>수거 운영 · 단가</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('HOMEPAGE')}
            className={`h-9 px-2 rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeCategory === 'HOMEPAGE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-blue-600 shrink-0 hidden sm:inline" />
            <span>홈페이지 · 이벤트</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('APP_SMS')}
            className={`h-9 px-2 rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeCategory === 'APP_SMS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0 hidden sm:inline" />
            <span>앱 설치 · 문자접수</span>
          </button>
        </div>
      </div>

      {/* ==================== 탭 1: 수거 운영 · 단가 · 권역 ==================== */}
      {activeCategory === 'OPS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* 좌측 열: 단가표 요약 + 사용자 정의 권역 */}
          <div className="space-y-4">
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    품목별 수거 단가표
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  총 {priceTableItems.length}개 품목
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                기사님이 수거 완료 처리 시 고객 모바일 영수증에 자동 계산되는 기준 단가입니다.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {priceTableItems.slice(0, 6).map((item) => (
                  <div
                    key={item.category}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-slate-600 truncate">
                      {item.label.split(' ')[0].replace(',', '')}
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums shrink-0">
                      {item.unitPrice.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onOpenPriceTableModal}
                className="w-full h-10 font-bold text-xs sm:text-sm rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100/80 transition-colors cursor-pointer"
              >
                전체 {priceTableItems.length}개 품목 단가 수정하기
              </button>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    사용자 정의 권역 관리
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {customRegions.length}개 권역
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                배차 화면에서 지역별로 묶어 보거나 전담 기사님을 배정할 권역을 설정합니다.
              </p>

              <div className="space-y-2">
                {customRegions.map((cr) => (
                  <div
                    key={cr.id}
                    className="flex items-start justify-between gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{cr.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 break-keep">{cr.areas.join(', ')}</p>
                    </div>
                    <button
                      type="button"
                      disabled={deletingRegionId === cr.id}
                      onClick={() => onDeleteRegion(cr.id)}
                      className="h-7 px-2.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-semibold text-red-600 shrink-0 inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>삭제</span>
                    </button>
                  </div>
                ))}

                {isAddingRegion ? (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <input
                      type="text"
                      value={newRegionForm.name}
                      onChange={(e) => setNewRegionForm({ ...newRegionForm, name: e.target.value })}
                      placeholder="권역 이름 (예: A권역 · 수원/용인)"
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg bg-white text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white p-2 space-y-1">
                      {areaOptions.map((area) => {
                        const isSelected = newRegionForm.selectedAreas.includes(area);
                        return (
                          <div
                            key={area}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1.5 rounded-lg ${
                              isSelected ? 'bg-blue-50/70' : ''
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleArea(area)}
                                className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                              />
                              <span
                                className={`text-xs sm:text-sm ${
                                  isSelected ? 'font-bold text-blue-900' : 'text-slate-700'
                                }`}
                              >
                                {area}
                              </span>
                            </label>
                            {isSelected && (
                              <input
                                type="text"
                                value={newRegionForm.exceptions[area] || ''}
                                onChange={(e) => onExceptionChange(area, e.target.value)}
                                placeholder="예: -만세구"
                                className="h-7 px-2 border border-slate-200 rounded bg-white text-xs text-slate-800 sm:w-28"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingRegion(false)}
                        className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={onAddRegion}
                        disabled={isSubmittingRegion}
                        className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white cursor-pointer"
                      >
                        {isSubmittingRegion ? '저장 중...' : '권역 저장'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingRegion(true)}
                    className="w-full h-10 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>새 권역 추가하기</span>
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* 우측 열: 기사·계정 관리 + 알림톡 + 영수증 이벤트 문구 */}
          <div className="space-y-4">
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  소속 기사 및 계정 보안
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                현장 수거를 담당할 신규 기사님 계정을 발급하거나 관리자 비밀번호를 변경합니다.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenDriverModal}
                  className="h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>기사님 추가</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPasswordModal}
                  className="h-10 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>비밀번호 변경</span>
                </button>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    카카오 알림톡 · 리텐션 자동화
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold rounded-md">
                  알리고 연동 옵션
                </span>
              </div>

              <div className="divide-y divide-slate-100 border-t border-slate-100">
                <div className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">단계별 알림톡 자동 발송</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      배정·일정확정·출발·완료 단계마다 고객 카카오톡으로 안내합니다.
                    </p>
                  </div>
                  <SettingToggle
                    checked={settings.useBizMessage}
                    onToggle={() => setSettings({ ...settings, useBizMessage: !settings.useBizMessage })}
                    label="기본 알림톡 자동 발송"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">3개월 주기 재수거 안내 (CRM)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      수거 완료 3개월 뒤 재이용 유도 알림톡을 자동 발송합니다.
                    </p>
                  </div>
                  <SettingToggle
                    checked={settings.useCrmAutomation}
                    onToggle={() => setSettings({ ...settings, useCrmAutomation: !settings.useCrmAutomation })}
                    label="CRM 리텐션 자동화"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    모바일 영수증 · 리뷰 이벤트 문구
                  </h3>
                </div>
                <SettingToggle
                  checked={Boolean(settings.eventIsActive)}
                  onToggle={() => setSettings({ ...settings, eventIsActive: !settings.eventIsActive })}
                  label="영수증 이벤트 문구 활성화"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                수거 완료 문자와 모바일 영수증 상단에 노출되어 고객 후기 작성을 유도합니다.
              </p>

              {settings.eventIsActive ? (
                <textarea
                  value={settings.eventText || ''}
                  onChange={(e) => setSettings({ ...settings, eventText: e.target.value })}
                  placeholder="예: 간편 리뷰 작성 시 매월 추첨을 통해 치킨 기프티콘을 드립니다!"
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600 resize-none"
                />
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-400">
                  현재 비활성화됨 — 우측 스위치를 켜면 안내 문구를 입력할 수 있습니다.
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ==================== 탭 2: 홈페이지 공지 · 이벤트 ==================== */}
      {activeCategory === 'HOMEPAGE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* 좌측 열: 상단 띠 공지 + 메인 팝업 배너 */}
          <div className="space-y-4">
            {globalSettings && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      상단 전역 띠 공지
                    </h3>
                  </div>
                  <SettingToggle
                    checked={globalSettings.noticeIsActive}
                    onToggle={() =>
                      setGlobalSettings({
                        ...globalSettings,
                        noticeIsActive: !globalSettings.noticeIsActive,
                      })
                    }
                    label="전역 공지사항 활성화"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  명절 휴무·긴급 안내 등 홈페이지와 앱 전체 최상단에 띄울 공지 배너입니다.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      배너 한 줄 문구
                    </label>
                    <textarea
                      value={globalSettings.globalNotice}
                      onChange={(e) =>
                        setGlobalSettings({ ...globalSettings, globalNotice: e.target.value })
                      }
                      placeholder="예: 설 연휴 2/9~2/12 수거 휴무 안내"
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      클릭 시 상세 팝업 안내문 <span className="font-normal text-slate-400">(선택)</span>
                    </label>
                    <textarea
                      value={globalSettings.globalNoticeDetail || ''}
                      onChange={(e) =>
                        setGlobalSettings({ ...globalSettings, globalNoticeDetail: e.target.value })
                      }
                      placeholder="띠 배너 클릭 시 상세 안내 팝업에 표시할 내용"
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                </div>
              </section>
            )}

            {globalSettings && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      홈페이지 메인 팝업 배너
                    </h3>
                  </div>
                  <SettingToggle
                    checked={Boolean(globalSettings.popupIsActive)}
                    onToggle={() =>
                      setGlobalSettings({
                        ...globalSettings,
                        popupIsActive: !globalSettings.popupIsActive,
                      })
                    }
                    label="홈페이지 팝업 배너 활성화"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  고객이 메인 홈페이지 접속 시 띄울 이벤트·공지 이미지입니다. 파일을 직접 올리거나 이미지 URL을 입력할 수 있습니다.
                </p>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-700">팝업 이미지</label>
                    <div className="flex items-center gap-1.5">
                      <label
                        className={`h-8 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          isUploadingPopup ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {isUploadingPopup ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{isUploadingPopup ? '최적화 중...' : '이미지 파일 선택'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleSelectPopupImageFile}
                          disabled={isUploadingPopup}
                        />
                      </label>
                      {globalSettings.popupImageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setGlobalSettings({
                              ...globalSettings,
                              popupImageUrl: '',
                              popupIsActive: false,
                            })
                          }
                          className="h-8 px-2.5 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>초기화</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={
                      globalSettings.popupImageUrl?.startsWith('data:image/')
                        ? ''
                        : globalSettings.popupImageUrl || ''
                    }
                    onChange={(e) =>
                      setGlobalSettings({ ...globalSettings, popupImageUrl: e.target.value })
                    }
                    placeholder={
                      globalSettings.popupImageUrl?.startsWith('data:image/')
                        ? '직접 업로드한 이미지 적용됨 (외부 URL로 변경 시 입력)'
                        : 'https://example.com/popup.png'
                    }
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                  />

                  {globalSettings.popupImageUrl && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                      <img
                        src={globalSettings.popupImageUrl}
                        alt="팝업 미리보기"
                        className="h-24 w-auto rounded-lg border border-slate-200 object-contain bg-white"
                      />
                      <div className="text-xs text-slate-500">
                        <p className="font-semibold text-slate-800">현재 등록된 팝업 미리보기</p>
                        <p className="mt-0.5">
                          상단 스위치가 켜져 있으면 메인 홈페이지 진입 시 노출됩니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* 우측 열: 이벤트 발표 유튜브 영상 + 치킨 기프티콘 당첨자 인증샷 */}
          <div className="space-y-4">
            {globalSettings && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    이벤트 당첨자 발표 영상
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  유튜브 링크를 입력하면 홈페이지 진행중인 이벤트 영역에 추첨 발표 영상이 재생됩니다.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    YouTube 영상 링크 (URL)
                  </label>
                  <input
                    type="text"
                    value={globalSettings.eventYoutubeUrl || ''}
                    onChange={(e) =>
                      setGlobalSettings({ ...globalSettings, eventYoutubeUrl: e.target.value })
                    }
                    placeholder="예: https://youtu.be/... 또는 https://www.youtube.com/watch?v=..."
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </section>
            )}

            {globalSettings && (
              <EventProofManager
                title={globalSettings.eventProofTitle || ''}
                images={globalSettings.eventProofImages || []}
                onChangeTitle={(nextTitle) =>
                  setGlobalSettings({ ...globalSettings, eventProofTitle: nextTitle })
                }
                onChangeImages={(nextImages) =>
                  setGlobalSettings({ ...globalSettings, eventProofImages: nextImages })
                }
                onSave={() => onSaveSettings()}
                isSaving={isSavingSettings}
              />
            )}
          </div>
        </div>
      )}

      {/* ==================== 탭 3: 앱 설치 · 문자 자동접수 ==================== */}
      {activeCategory === 'APP_SMS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* 좌측 열: 사무실 공기계 문자 자동접수 APK 설치 및 가이드 */}
          <div>
            <InstallProgramManualSection onOpenSmsModal={onOpenSmsAutoModal} />
          </div>

          {/* 우측 열: 010 문자접수 대표 전화번호 + 배차 콘솔 웹앱 저장 */}
          <div className="space-y-4">
            {globalSettings && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      010 문자접수 대표 전화번호
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      hasActiveRepPhone
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {hasActiveRepPhone ? '홈페이지 버튼 노출 중' : '홈페이지 버튼 숨김(안전)'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  좌측 전용 앱(<code className="px-1 bg-slate-100 rounded font-mono text-[11px]">allclear-app.apk</code>)을 공기계에 설치·가동하신 뒤 해당 공기계의 010 번호를 입력해 저장하세요.
                </p>

                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={globalSettings.representativePhone || ''}
                    onChange={(e) =>
                      setGlobalSettings({
                        ...globalSettings,
                        representativePhone: e.target.value,
                      })
                    }
                    placeholder="예: 010-1234-5678 (비워두면 홈페이지 문자접수 숨김)"
                    className="flex-1 h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 tabular-nums focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => onSaveSettings()}
                    disabled={isSavingSettings}
                    className="h-10 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>저장</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                  ※ 번호 칸을 비워두시면 고객 홈페이지에 <strong>[010 문자 접수] 버튼이 노출되지 않아</strong> 공기계 준비 전에도 기존 카카오 수거신청만 안전하게 운영됩니다.
                </p>
              </section>
            )}

            <PwaInstallButton role="admin" variant="settings-card" hideWhenInstalled={false} />
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X,
  Copy,
  Check,
  Smartphone,
  MessageSquareText,
  Play,
  Download,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Spinner from './Spinner';
import { resolveApiBaseUrl, resolveServerRootUrl } from '../utils/apiUrl';

interface SmsAutoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  onSimulatedSuccess: () => void;
}

interface SmsConfigInfo {
  activeAnalyzer: 'GEMINI' | 'OPENAI' | 'REGEX_FALLBACK';
  aiStatusWarning?: string | null;
  hasGeminiKey?: boolean;
  kakaoAddressVerified: boolean;
  representativePhone: string;
  webhookUrl: string;
  apkDownloadUrl?: string;
  sampleJsonPayload: string;
}

const SAMPLE_SMS_CASES = [
  {
    label: '예시 1 · 수원 광교 아파트 + 봉투수',
    phone: '010-8282-1234',
    text: '수원시 영통구 이의동 광교자연앤힐스테이트 5402동 1203호입니다. 공동현관 #1234* 이고 100리터 봉투 3개 헌옷이랑 가방 정리해두었는데 내일 비대면 수거 가능할까요?',
  },
  {
    label: '예시 2 · 화성 동탄 지번 + 희망일 + 무게',
    phone: '010-5555-7979',
    text: '화성시 반송동 104-2번지 201호입니다. 11월 20일 수거 될까요? 옷 30kg이랑 냄비 5kg 있습니다',
  },
  {
    label: '예시 3 · 광고 스팸 문자 자동 차단 확인',
    phone: '070-9999-0000',
    text: '[Web발신] (광고) 가을맞이 특가 할인 이벤트! 무료수신거부 080-123-4567',
  },
];

/**
 * 010 대표번호 문자 자동 수거신청 전용 앱(allclear-app.apk) 설치 안내 및 실시간 인식 시뮬레이터 모달
 *
 * [왜 배경 클릭 자동 닫힘을 제거했는가]
 * 텍스트 입력창에서 문자 원문을 마우스로 드래그하다가 커서가 모달 바깥으로 나갔을 때 창이 닫히는 실수를 방지하기 위함입니다.
 */
export default function SmsAutoConfigModal({
  isOpen,
  onClose,
  authToken,
  onSimulatedSuccess,
}: SmsAutoConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'GUIDE' | 'SIMULATE'>('GUIDE');
  const [configInfo, setConfigInfo] = useState<SmsConfigInfo | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [testPhone, setTestPhone] = useState(SAMPLE_SMS_CASES[0].phone);
  const [testMessage, setTestMessage] = useState(SAMPLE_SMS_CASES[0].text);
  // 왜 기본값을 false(미리보기 전용)로 두는가:
  // 정식 운영 중인 사장님이 실제 고객 문자가 어떻게 파싱되는지 안심하고 테스트해볼 수 있도록 기본적으로는 미리보기만 수행하고,
  // 원할 때만 체크박스를 켜서 실제 접수 목록에 테스트 카드로 등록할 수 있게 배려했습니다.
  const [saveToDb, setSaveToDb] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const apiBase = resolveApiBaseUrl();
  const serverRootUrl = resolveServerRootUrl();
  const webOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://www.all-cle.com';

  const shareableApkUrl =
    webOrigin.includes('localhost') || webOrigin.includes('127.0.0.1')
      ? `${apiBase}/sms/apk`
      : `${webOrigin}/downloads/allclear-app.apk`;

  const fetchConfig = () => {
    if (!authToken) return;
    setLoadingConfig(true);
    axios
      .get(`${import.meta.env.VITE_API_URL}/sms/config`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      .then((res) => setConfigInfo(res.data))
      .catch((err) => console.error('SMS 설정 조회 실패:', err))
      .finally(() => setLoadingConfig(false));
  };

  useEffect(() => {
    if (!isOpen || !authToken) return;
    fetchConfig();
  }, [isOpen, authToken]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      alert('클립보드 복사에 실패했습니다. 직접 드래그하여 복사해 주세요.');
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/sms/simulate`,
        {
          senderPhone: testPhone,
          messageContent: testMessage,
          saveToDb,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      setSimResult(res.data);
      fetchConfig();
      if (res.data?.registered) {
        onSimulatedSuccess();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || '문자 분석 테스트 중 오류가 발생했습니다.');
    } finally {
      setSimulating(false);
    }
  };

  const isRealAiRunning =
    configInfo?.activeAnalyzer === 'GEMINI' || configInfo?.activeAnalyzer === 'OPENAI';

  const analyzerLabel = isRealAiRunning
    ? `AI 정밀 분석기 연동 중 (${configInfo?.activeAnalyzer})`
    : configInfo?.aiStatusWarning
      ? configInfo.aiStatusWarning
      : '내장 한국어 주소 파서 가동 중 (API 키 없이도 즉시 동작)';

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] z-[110] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-gray-200">
        {/* 상단 헤더 */}
        <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-gray-900 tracking-tight">
              📩 010 문자 자동접수 & 전용 앱 설치
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              사무실 공기계에 올클 전용 앱을 설치하면 고객 문자 신청이 실시간으로 자동 등록됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 연동 상태 바 */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isRealAiRunning ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
            <span>{loadingConfig ? '연동 상태 확인 중...' : analyzerLabel}</span>
          </div>
          <div className="text-gray-600 font-medium whitespace-nowrap">
            카카오 표준주소 보정:{' '}
            <strong className={configInfo?.kakaoAddressVerified ? 'text-emerald-700' : 'text-amber-700'}>
              {configInfo?.kakaoAddressVerified ? '연동됨' : '미설정'}
            </strong>
          </div>
        </div>

        {/* 상단 탭 전환 (공기계 앱 설치 · 연동 vs 문자 인식 테스트) */}
        <div className="px-5 pt-3 pb-2 bg-white border-b border-gray-100 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('GUIDE')}
              className={`h-9 rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'GUIDE'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>공기계 앱 설치 · 연동</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SIMULATE')}
              className={`h-9 rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'SIMULATE'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquareText className="w-4 h-4" />
              <span>문자 인식 테스트</span>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'SIMULATE' ? (
            <form onSubmit={handleRunSimulation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  샘플 문자 불러오기 (클릭 시 자동 입력)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_SMS_CASES.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTestPhone(sample.phone);
                        setTestMessage(sample.text);
                        setSimResult(null);
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200/80 text-gray-700 border border-gray-200 transition-colors cursor-pointer"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">고객 발신 번호</label>
                  <input
                    type="text"
                    required
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm tabular-nums focus:border-blue-600 outline-none"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-200 w-full">
                    <input
                      type="checkbox"
                      checked={saveToDb}
                      onChange={(e) => setSaveToDb(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-600 shrink-0"
                    />
                    <span>신규 수거 요청 목록에도 실제 테스트 카드로 등록하기</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">고객 수신 문자 원문</label>
                <textarea
                  required
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="예: 수원시 영통구 광교중앙로 145 102동 1503호입니다. 옷 30kg 내일 수거 될까요?"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:border-blue-600 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-sm"
              >
                {simulating ? (
                  <Spinner className="w-4 h-4 text-white" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>{saveToDb ? '문자 분석 및 테스트 접수 등록' : '문자 주소·물량 인식 미리보기'}</span>
                  </>
                )}
              </button>

              {simResult && (
                <div
                  className={`mt-4 p-4 rounded-2xl border text-sm ${
                    simResult.registered
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : simResult.previewOnly
                      ? 'bg-blue-50 border-blue-200 text-blue-950'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="font-bold text-sm mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {simResult.registered
                        ? '✅ 신규 문자 수거 요청 목록에 등록되었습니다!'
                        : simResult.previewOnly
                        ? '🔍 문자 주소·물량 인식 결과 (미리보기)'
                        : `⛔ 자동 제외됨: ${simResult.skippedReason}`}
                    </span>
                  </div>

                  {simResult.analysis && (
                    <div className="bg-white rounded-xl p-3.5 space-y-1.5 text-xs border border-gray-200 text-gray-700">
                      <p>
                        <strong className="text-gray-900">분석 엔진:</strong>{' '}
                        {simResult.analysis.analyzerUsed}
                      </p>
                      <p>
                        <strong className="text-gray-900">추출 기본주소:</strong>{' '}
                        {simResult.analysis.rawAddress || '(원문 참조)'}
                      </p>
                      <p>
                        <strong className="text-gray-900">추출 상세주소:</strong>{' '}
                        {simResult.analysis.detailAddress || '(없음)'}
                      </p>
                      <p>
                        <strong className="text-gray-900">품목·물량 요약:</strong>{' '}
                        {simResult.analysis.itemsSummary || '(별도 수량 표기 없음)'}
                      </p>
                      {simResult.analysis.desiredDateISO && (
                        <p className="tabular-nums">
                          <strong className="text-gray-900">희망수거일:</strong>{' '}
                          <span className="font-bold text-blue-700">{simResult.analysis.desiredDateISO}</span>
                        </p>
                      )}
                      {simResult.normalizedAddress && (
                        <p className="text-emerald-800 font-medium">
                          <strong className="text-gray-900">카카오 표준주소 보정:</strong>{' '}
                          {simResult.normalizedAddress.standardAddress} ({simResult.normalizedAddress.zipCode})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-4 text-sm text-gray-700">
              {/* 사무실 공기계 문자수신 APK 카드 */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-gray-900 text-sm sm:text-base">
                      사무실 문자수신 전용 앱 (allclear-app.apk)
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      플레이스토어 검색 없이 아래 버튼 또는 QR코드로 공기계에 바로 설치합니다.
                    </p>
                  </div>
                  {configInfo?.representativePhone && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white text-blue-700 border border-blue-200 tabular-nums">
                      수신 대표번호: {configInfo.representativePhone}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="/downloads/allclear-app.apk"
                    download="allclear-app.apk"
                    className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>전용 앱(.apk) 다운로드</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    className="h-9 px-3 rounded-xl bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-blue-600" />
                    <span>{showQr ? 'QR코드 숨기기' : 'QR코드로 공기계 설치'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(serverRootUrl, 'server_root')}
                    className="h-9 px-3 rounded-xl bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedField === 'server_root' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> 서버 주소 복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> 서버 주소 복사
                      </>
                    )}
                  </button>
                </div>

                {showQr && (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-blue-100 rounded-xl p-3.5">
                    <div className="p-2 bg-white border border-gray-200 rounded-xl shrink-0">
                      <QRCodeSVG value={shareableApkUrl} size={108} level="M" />
                    </div>
                    <div className="space-y-1 text-xs text-gray-700">
                      <p className="font-bold text-gray-900">
                        공기계 카메라로 스캔하면 즉시 APK가 다운로드됩니다
                      </p>
                      <p className="text-[11px] text-gray-500 break-all">{shareableApkUrl}</p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-white border border-gray-200 p-3.5 text-xs text-gray-700 space-y-1.5 leading-relaxed">
                  <p className="font-bold text-gray-900 mb-1">📱 공기계 설치 순서 (최초 1회, 1분 완료)</p>
                  <p>
                    <strong>1단계:</strong> 공기계 <strong>설정 → 보안 및 개인정보 보호 → 보안 위험 자동 차단 → OFF</strong>
                  </p>
                  <p>
                    <strong>2단계:</strong> <code className="px-1 bg-gray-100 rounded font-mono text-[11px]">allclear-app.apk</code> 실행 → <strong>무시하고 설치</strong>
                  </p>
                  <p>
                    <strong>3단계:</strong> Android 13/14에서 권한이 잠겨 있으면 <strong>설정 → 애플리케이션 → 올클 문자자동접수 → 우측 상단 [⋮] → 제한된 설정 허용</strong> 후 문자(SMS) 허용
                  </p>
                  <p>
                    <strong>4단계:</strong> 앱 실행 → 올클 정식 서버 주소 자동입력 확인 → <strong>[🟢 문자 권한 허용 & 자동접수 시작 (ON)]</strong> 터치!
                  </p>
                </div>
              </div>

              {/* 외부 웹훅 연동 정보 (MacroDroid / SMS Forwarder 호환용) */}
              <details className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs">
                <summary className="font-bold text-gray-800 cursor-pointer select-none">
                  고급 설정 · 외부 문자 포워더(MacroDroid / SMS Forwarder) 연동용 Webhook 정보
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-600">Webhook URL</label>
                      <button
                        type="button"
                        onClick={() =>
                          configInfo?.webhookUrl && handleCopy(configInfo.webhookUrl, 'url')
                        }
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'url' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> 복사됨
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> URL 복사
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2.5 bg-gray-900 text-gray-100 font-mono text-xs rounded-lg break-all">
                      {configInfo?.webhookUrl || '서버 설정 불러오는 중...'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-600">POST JSON 포맷</label>
                      <button
                        type="button"
                        onClick={() =>
                          configInfo?.sampleJsonPayload &&
                          handleCopy(configInfo.sampleJsonPayload, 'json')
                        }
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'json' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> 복사됨
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> JSON 복사
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-2.5 bg-gray-900 text-gray-200 font-mono text-xs rounded-lg overflow-x-auto">
                      {configInfo?.sampleJsonPayload || '{\n  "from": "%from%",\n  "text": "%text%"\n}'}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

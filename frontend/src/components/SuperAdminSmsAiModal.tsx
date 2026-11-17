import { useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Copy, Download, KeyRound, QrCode, Smartphone, Sparkles, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Spinner from './Spinner';
import { resolveApiBaseUrl, resolveServerRootUrl } from '../utils/apiUrl';

interface SuperAdminSmsAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

/**
 * 슈퍼관리자 전용: 문자 자동접수 Gemini AI API 키 DB 영구 저장 및 전용 APK 배포 관리 모달
 *
 * [왜 별도 컴포넌트로 분리했는가]
 * SuperAdminDashboard의 비대화를 막고, 클라우드(Railway) 재배포 후에도 초기화되지 않는
 * 매니지드 Gemini AI 키 등록·해제와 공기계 APK 배포 현황을 한곳에서 안전하게 제어하기 위함입니다.
 */
export default function SuperAdminSmsAiModal({
  isOpen,
  onClose,
  authToken,
}: SuperAdminSmsAiModalProps) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

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

  const fetchConfig = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/sms/config`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setConfig(res.data);
    } catch (err) {
      console.error('슈퍼관리자 SMS 설정 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && authToken) {
      void fetchConfig();
    }
  }, [isOpen, authToken]);

  if (!isOpen) return null;

  const handleSaveGeminiKey = async (clear = false) => {
    if (!authToken) return;
    const keyToSave = clear ? '' : geminiKeyInput.trim();
    if (!clear && !keyToSave) {
      alert('등록할 Google Gemini API 키를 입력해주세요.');
      return;
    }

    setSavingKey(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/sms/gemini-key`,
        { geminiApiKey: keyToSave },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      alert(res.data?.message || '저장되었습니다.');
      setGeminiKeyInput('');
      await fetchConfig();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gemini API 키 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert(text);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] z-[120] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-extrabold text-gray-900">
              문자 자동접수 AI · 전용앱 관제 (슈퍼관리자)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* 현재 상태 요약 */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-600">현재 활성 문자 분석기</span>
              <span className="font-extrabold text-indigo-700">
                {loading
                  ? '확인 중...'
                  : config?.activeAnalyzer === 'GEMINI'
                  ? '🟢 Google Gemini AI 가동 중'
                  : config?.activeAnalyzer === 'OPENAI'
                  ? '🟢 OpenAI GPT 가동 중'
                  : '🔵 내장 한국어 정규식 파서 가동 중'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-600">카카오 로컬 표준주소 보정</span>
              <span className="font-bold text-gray-900">
                {config?.kakaoAddressVerified ? '연동됨' : '미설정'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-600">현재 수신 대표 전화번호</span>
              <span className="font-bold text-gray-900 tabular-nums">
                {config?.representativePhone || '미등록 (사장님 설정에서 지정 가능)'}
              </span>
            </div>
            {config?.aiStatusWarning && (
              <p className="text-amber-700 font-semibold pt-1">⚠️ {config.aiStatusWarning}</p>
            )}
          </div>

          {/* Gemini API 키 등록 카드 */}
          <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Google Gemini API 키 영구 등록 (선택)</span>
              </div>
              {config?.hasGeminiKey && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  등록됨
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              입력하신 키는 PostgreSQL DB(<code className="px-1 bg-white rounded">GlobalSettings</code>)에 백업되어 Railway 서버 재배포 후에도 자동 복원됩니다. 키를 등록하지 않아도 내장 한국어 주소 파서가 무료로 24시간 동작합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder={config?.hasGeminiKey ? '새 Gemini API 키로 교체 시 입력...' : 'AIza... 또는 AQ.... 키 입력'}
                className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:border-indigo-600 outline-none"
              />
              <button
                type="button"
                disabled={savingKey}
                onClick={() => void handleSaveGeminiKey(false)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {savingKey ? <Spinner className="w-3.5 h-3.5 text-white" /> : '키 저장 · 활성화'}
              </button>
              {config?.hasGeminiKey && (
                <button
                  type="button"
                  disabled={savingKey}
                  onClick={() => void handleSaveGeminiKey(true)}
                  className="px-3 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold shrink-0 cursor-pointer"
                >
                  키 해제
                </button>
              )}
            </div>
          </div>

          {/* 사무실 공기계 APK 배포 */}
          <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-3">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span>사무실 공기계 전용 앱 (allclear-app.apk)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/downloads/allclear-app.apk"
                download="allclear-app.apk"
                className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>APK 다운로드</span>
              </a>
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className="h-9 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQr ? 'QR 닫기' : 'QR 보기'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopy(shareableApkUrl, 'apk')}
                className="h-9 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied === 'apk' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'apk' ? '링크 복사됨' : '설치 링크 복사'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopy(serverRootUrl, 'srv')}
                className="h-9 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied === 'srv' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'srv' ? '서버주소 복사됨' : '서버주소 복사'}</span>
              </button>
            </div>
            {showQr && (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="p-2 bg-white rounded-lg border border-gray-200 shrink-0">
                  <QRCodeSVG value={shareableApkUrl} size={96} level="M" />
                </div>
                <p className="text-xs text-gray-600 break-all">{shareableApkUrl}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

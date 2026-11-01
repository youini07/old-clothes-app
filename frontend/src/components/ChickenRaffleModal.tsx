import { useEffect, useRef, useState } from 'react';

export interface RaffleParticipant {
  id: string;
  label: string;       // 예: "박정*(1234)"
  authorName: string;  // 예: "박정*"
  phoneSuffix: string; // 예: "1234"
}

interface ChickenRaffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: RaffleParticipant[];
  winnerCount: number;
  startDate: string;
  endDate: string;
}

type RaffleStage = 'shuffling' | 'spinning' | 'finished';

/**
 * 왜 별도 모달 컴포넌트로 분리했는가:
 * AdminDashboard의 비대화를 막고(모듈화), 영상 촬영용 추첨 애니메이션(타이머, 오디오 합성, 슬롯 감속 연출)의
 * 생명주기를 독립적으로 안전하게 관리하기 위함입니다.
 */
export default function ChickenRaffleModal({
  isOpen,
  onClose,
  participants,
  winnerCount,
  startDate,
  endDate,
}: ChickenRaffleModalProps) {
  const [stage, setStage] = useState<RaffleStage>('shuffling');
  const [currentWinnerStep, setCurrentWinnerStep] = useState<number>(0); // 현재 몇 번째 당첨자를 뽑는 중인지 (0-indexed)
  const [confirmedWinners, setConfirmedWinners] = useState<RaffleParticipant[]>([]);
  const [rollingIndex, setRollingIndex] = useState<number>(0); // 슬롯머신 중앙에 표시되는 현재 후보 인덱스
  const [isDecelerating, setIsDecelerating] = useState<boolean>(false); // 감속 구간 여부 (긴장감 연출용)
  const [isJustLocked, setIsJustLocked] = useState<boolean>(false); // 방금 당첨자가 확정된 순간의 임팩트 연출용
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [shuffleProgress, setShuffleProgress] = useState<number>(0);
  const [showFullPool, setShowFullPool] = useState<boolean>(false);

  // 타이머 및 오디오 컨텍스트 정리용 Ref
  const timeoutsRef = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef<boolean>(true);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // 모든 비동기 타이머 일괄 정리 함수 (언마운트 또는 재추첨 시 메모리 누수 방지)
  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  };

  const registerTimeout = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  // 왜 Web Audio API를 사용하는가:
  // 외부 음원 파일(mp3) 의존성이나 네트워크 로딩 지연 없이, 영상 촬영 시 슬롯이 돌아가는 '틱-틱-틱' 소리와
  // 당첨 확정 팡파레 사운드를 즉각 재생하여 추첨 영상의 박진감을 극대화하기 위함입니다.
  const getAudioContext = (): AudioContext | null => {
    if (!soundEnabledRef.current) return null;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  // 슬롯이 한 칸 넘어갈 때 나는 경쾌한 '딸깍(틱)' 효과음
  const playTickSound = (freq = 520) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // 오디오 재생 실패 시 무시 (UI 동작에 영향 없도록 처리)
    }
  };

  // 개별 당첨자 슬롯이 멈췄을 때 나는 '띵동!' 확정 사운드
  const playLockInSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const notes = [587.33, 880]; // D5 -> A5
      notes.forEach((note, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.36);
      });
    } catch {
      // 무시
    }
  };

  // 최종 당첨자 발표 시 울리는 축하 화음 팡파레
  const playFanfareSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      chord.forEach((note, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startTime = ctx.currentTime + idx * 0.08;
        osc.frequency.setValueAtTime(note, startTime);
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.85);
      });
    } catch {
      // 무시
    }
  };

  /**
   * 공정한 무작위 당첨자 선정 함수
   * 왜 중복 이름(label) 제거 로직을 넣었는가:
   * 한 고객이 기간 내 여러 번 후기를 남겼더라도 2명 이상 추첨 시 동일인이 중복 당첨되는 일을 방지하기 위함입니다.
   * 단, 고유 인원수가 당첨자 수보다 적을 때만 예외적으로 남은 응모권에서 추가 선발합니다.
   */
  const pickFairWinners = (pool: RaffleParticipant[], count: number): RaffleParticipant[] => {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected: RaffleParticipant[] = [];
    const usedLabels = new Set<string>();
    const usedIds = new Set<string>();

    // 1차: 서로 다른 고객(label 기준) 우선 선발
    for (const candidate of shuffled) {
      if (selected.length >= count) break;
      if (!usedLabels.has(candidate.label)) {
        selected.push(candidate);
        usedLabels.add(candidate.label);
        usedIds.add(candidate.id);
      }
    }

    // 2차: 만약 고유 고객 수가 당첨 인원보다 적다면 남은 응모권 중에서 채움
    for (const candidate of shuffled) {
      if (selected.length >= count) break;
      if (!usedIds.has(candidate.id)) {
        selected.push(candidate);
        usedIds.add(candidate.id);
      }
    }

    return selected;
  };

  // 전체 추첨 시퀀스 시작 함수 (영상 촬영용 다단계 긴장감 연출)
  const startRaffleSequence = () => {
    if (!participants || participants.length === 0) return;

    clearAllTimeouts();
    const targetCount = Math.min(Math.max(1, winnerCount), participants.length);
    const preselectedWinners = pickFairWinners(participants, targetCount);

    setStage('shuffling');
    setConfirmedWinners([]);
    setCurrentWinnerStep(0);
    setIsDecelerating(false);
    setIsJustLocked(false);
    setShuffleProgress(0);

    // ── 1단계: 응모권 믹싱 연출 (약 1.8초 동안 게이지 상승 및 명단 셔플) ──
    const shuffleDuration = 1800;
    const shuffleSteps = 18;
    for (let s = 1; s <= shuffleSteps; s++) {
      registerTimeout(() => {
        setShuffleProgress(Math.round((s / shuffleSteps) * 100));
        setRollingIndex(Math.floor(Math.random() * participants.length));
        if (s % 2 === 0) playTickSound(380 + s * 12);
      }, (shuffleDuration / shuffleSteps) * s);
    }

    // ── 2단계: 당첨자별 고속 슬롯 롤링 -> 점진적 감속 -> 당첨 확정 연출 ──
    const runSingleWinnerSpin = (winnerIdx: number, winnersSoFar: RaffleParticipant[]) => {
      setStage('spinning');
      setCurrentWinnerStep(winnerIdx);
      setIsDecelerating(false);
      setIsJustLocked(false);

      const targetWinner = preselectedWinners[winnerIdx];
      const targetPoolIndex = Math.max(
        0,
        participants.findIndex((p) => p.id === targetWinner.id)
      );

      // 슬롯이 돌아가는 시간 간격(ms) 배열:
      // 초반에는 매우 빠르게(55ms) 돌아가다가, 후반부에는 '딸깍... 딸깍... 딸깍...' 하며 멈추는 실제 룰렛 감속 커브
      const fastTicks = winnerIdx === 0 ? 28 : 20;
      const intervals: number[] = [
        ...Array(fastTicks).fill(55),
        70, 75, 85, 95, 110, 130, 155, 185, 220, 265, 320, 390, 480
      ];

      const totalTicks = intervals.length;
      // 마지막 틱에서 정확히 targetPoolIndex에 도달하도록 시작 오프셋 역산
      const startOffset = (targetPoolIndex - totalTicks % participants.length + participants.length) % participants.length;

      let accumulatedTime = 0;
      intervals.forEach((intervalMs, tickIdx) => {
        accumulatedTime += intervalMs;
        registerTimeout(() => {
          const nextIdx = (startOffset + tickIdx + 1) % participants.length;
          setRollingIndex(nextIdx);

          // 감속 구간 진입 시 시각적 긴장감 배너 활성화 및 사운드 피치 상승
          const isSlowingDown = tickIdx >= fastTicks;
          if (isSlowingDown) {
            setIsDecelerating(true);
          }
          const pitch = isSlowingDown ? 540 + (tickIdx - fastTicks) * 28 : 480 + (tickIdx % 5) * 15;
          playTickSound(pitch);
        }, accumulatedTime);
      });

      // 마지막 틱 직후: 해당 당첨자 슬롯 확정 임팩트!
      registerTimeout(() => {
        setRollingIndex(targetPoolIndex);
        setIsJustLocked(true);
        playLockInSound();

        const nextConfirmed = [...winnersSoFar, targetWinner];
        setConfirmedWinners(nextConfirmed);

        // 다음 당첨자가 남아있으면 1.1초간 확정 축하 후 다음 슬롯 회전, 모두 뽑았으면 최종 발표 화면으로 전환
        registerTimeout(() => {
          if (winnerIdx + 1 < targetCount) {
            runSingleWinnerSpin(winnerIdx + 1, nextConfirmed);
          } else {
            setStage('finished');
            playFanfareSound();
          }
        }, 1150);
      }, accumulatedTime + 80);
    };

    registerTimeout(() => {
      runSingleWinnerSpin(0, []);
    }, shuffleDuration + 150);
  };

  useEffect(() => {
    if (isOpen && participants.length > 0) {
      startRaffleSequence();
    } else {
      clearAllTimeouts();
    }
    return () => clearAllTimeouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // 슬롯 위/아래에 보여줄 이전·다음 후보 계산 (입체적인 3열 릴 연출용)
  const prevIndex = (rollingIndex - 1 + participants.length) % Math.max(1, participants.length);
  const nextIndex = (rollingIndex + 1) % Math.max(1, participants.length);
  const prevCandidate = participants[prevIndex];
  const currentCandidate = participants[rollingIndex];
  const nextCandidate = participants[nextIndex];

  const winnersText = confirmedWinners.map((w) => w.label).join(', ');
  const fullAnnouncementText = `축당첨! 이번 치킨당첨자는 ${winnersText} 입니다.`;

  const handleCopyWinners = async () => {
    try {
      await navigator.clipboard.writeText(fullAnnouncementText);
      alert(`당첨 발표 문구가 복사되었습니다!\n\n${fullAnnouncementText}`);
    } catch {
      alert(fullAnnouncementText);
    }
  };

  const handleCopyAllParticipants = async () => {
    const allText = participants.map((p) => p.label).join(', ');
    try {
      await navigator.clipboard.writeText(allText);
      alert(`전체 응모 명단(${participants.length}명)이 복사되었습니다!`);
    } catch {
      alert(allText);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.35)] border-2 border-amber-400/60 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 화려한 조명 장식 바 */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 animate-pulse" />

        {/* 헤더 영역 */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10 flex items-center justify-between gap-2 bg-white/5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl animate-bounce">🍗</span>
            <div>
              <h2 className="text-base sm:text-xl font-black tracking-tight text-amber-300">
                리뷰 이벤트 치킨 당첨자 라이브 추첨
              </h2>
              <p className="text-[11px] sm:text-xs text-indigo-200 font-medium">
                📅 대상 기간: {startDate} ~ {endDate} · 총 <strong className="text-amber-300">{participants.length}명</strong> 응모 · 당첨 <strong className="text-amber-300">{Math.min(winnerCount, participants.length)}명</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                soundEnabled
                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
              title="추첨 효과음 켜기/끄기"
            >
              {soundEnabled ? '🔊 효과음 ON' : '🔇 효과음 OFF'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white font-bold transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 메인 스테이지 영역 */}
        <div className="p-5 sm:p-7">
          {/* ────── STAGE 1: 응모권 믹싱 단계 ────── */}
          {stage === 'shuffling' && (
            <div className="text-center py-6">
              <div className="relative w-28 h-28 mx-auto mb-5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-dashed border-amber-400/60 animate-spin" />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-amber-500/30 to-rose-500/30 animate-pulse" />
                <span className="text-5xl animate-bounce">🎰</span>
              </div>

              <p className="text-lg sm:text-2xl font-black text-amber-300 mb-2 animate-pulse">
                응모권 {participants.length}장을 추첨함에 넣고 섞는 중...
              </p>
              <p className="text-xs sm:text-sm text-indigo-200 mb-5">
                공정한 무작위 추첨을 위해 전체 명단을 셔플하고 있습니다!
              </p>

              {/* 셔플 게이지 바 */}
              <div className="max-w-md mx-auto h-3 bg-white/10 rounded-full overflow-hidden border border-white/15 mb-6">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-all duration-100"
                  style={{ width: `${shuffleProgress}%` }}
                />
              </div>

              {/* 셔플 중인 참가자 미리보기 칩들 */}
              <div className="max-h-36 overflow-hidden flex flex-wrap justify-center gap-1.5 px-2 opacity-90">
                {participants.slice(0, 30).map((p, idx) => {
                  const isHighlighted = (idx + rollingIndex) % 5 === 0;
                  return (
                    <span
                      key={p.id}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-75 ${
                        isHighlighted
                          ? 'bg-amber-400 text-slate-900 scale-105 shadow-md'
                          : 'bg-white/10 text-gray-300 border border-white/10'
                      }`}
                    >
                      {p.label}
                    </span>
                  );
                })}
                {participants.length > 30 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-amber-300">
                    외 +{participants.length - 30}명
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ────── STAGE 2: 슬롯머신 롤링 & 감속 추첨 액션 단계 ────── */}
          {stage === 'spinning' && (
            <div className="text-center">
              {/* 상단 현재 추첨 진행 상태 배지 */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-rose-500/30 to-amber-500/30 border border-amber-400/50 text-amber-200 text-xs sm:text-sm font-extrabold mb-4">
                <span className="animate-spin">🎯</span>
                <span>
                  {winnerCount > 1
                    ? `총 ${Math.min(winnerCount, participants.length)}명 중 ${currentWinnerStep + 1}번째 치킨 당첨자 추첨 중!`
                    : '행운의 치킨 주인공 추첨 중!'}
                </span>
              </div>

              {/* 긴장감 고조 메시지 */}
              <h3
                className={`text-lg sm:text-2xl font-black mb-4 transition-all ${
                  isJustLocked
                    ? 'text-emerald-300 scale-105'
                    : isDecelerating
                    ? 'text-amber-300 animate-bounce'
                    : 'text-white'
                }`}
              >
                {isJustLocked
                  ? `🎉 ${currentWinnerStep + 1}번째 당첨자 확정!! 🎉`
                  : isDecelerating
                  ? '🔥 두구두구두구... 과연 행운의 주인공은?! 🔥'
                  : '⚡ 추첨 룰렛이 빠르게 회전하고 있습니다! ⚡'}
              </h3>

              {/* 중앙 대형 3D 슬롯머신 릴 박스 */}
              <div
                className={`relative max-w-md mx-auto rounded-3xl p-4 sm:p-5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-4 transition-all duration-200 shadow-2xl mb-5 ${
                  isJustLocked
                    ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.6)] scale-[1.03]'
                    : isDecelerating
                    ? 'border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)]'
                    : 'border-indigo-400/60'
                }`}
              >
                {/* 윗줄 (지나간 후보 - 블러 효과) */}
                <div className="py-1.5 text-sm sm:text-base font-bold text-gray-500 opacity-50 blur-[0.5px] select-none truncate">
                  {prevCandidate?.label || '-'}
                </div>

                {/* 정중앙 당첨 라인 하이라이트 창 */}
                <div
                  className={`my-2 py-4 px-4 rounded-2xl border-2 flex items-center justify-between gap-2 transition-all ${
                    isJustLocked
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 border-white text-slate-950 shadow-xl'
                      : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 border-white text-slate-950 shadow-lg'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-black px-2 py-0.5 rounded bg-slate-900/20 text-slate-900 shrink-0">
                    ▶ 당첨 ◀
                  </span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight truncate">
                    {currentCandidate?.label || '-'}
                  </span>
                  <span className="text-xl sm:text-2xl shrink-0">🍗</span>
                </div>

                {/* 아랫줄 (다가오는 후보 - 블러 효과) */}
                <div className="py-1.5 text-sm sm:text-base font-bold text-gray-500 opacity-50 blur-[0.5px] select-none truncate">
                  {nextCandidate?.label || '-'}
                </div>
              </div>

              {/* 다수 추첨 시: 확정된 당첨자 슬롯 현황판 */}
              {winnerCount > 1 && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-indigo-200 mb-2">
                    🏆 실시간 당첨자 확정 현황 ({confirmedWinners.length} / {Math.min(winnerCount, participants.length)}명)
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {Array.from({ length: Math.min(winnerCount, participants.length) }).map((_, idx) => {
                      const lockedWinner = confirmedWinners[idx];
                      return (
                        <div
                          key={idx}
                          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold border transition-all ${
                            lockedWinner
                              ? 'bg-amber-400 text-slate-950 border-white shadow-md scale-105'
                              : idx === currentWinnerStep
                              ? 'bg-indigo-500/30 border-amber-400 text-amber-200 animate-pulse'
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}
                        >
                          {lockedWinner ? `🍗 ${idx + 1}번: ${lockedWinner.label}` : `${idx + 1}번째 추첨 대기...`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 하단 아케이드 스포트라이트 응모자 보드 (영상에서 내 이름이 실제로 있음을 보여주는 영역) */}
              <div className="bg-black/30 rounded-2xl p-3 border border-white/10">
                <p className="text-[11px] text-gray-400 font-bold mb-2">
                  📋 실시간 응모 명단 스포트라이트 (총 {participants.length}명)
                </p>
                <div className="max-h-28 overflow-y-auto flex flex-wrap justify-center gap-1.5 px-1">
                  {participants.map((p, idx) => {
                    const isCurrentPointer = idx === rollingIndex;
                    const isAlreadyWon = confirmedWinners.some((w) => w.id === p.id);
                    return (
                      <span
                        key={p.id}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all duration-75 ${
                          isAlreadyWon
                            ? 'bg-emerald-400 text-slate-950 ring-2 ring-white font-black'
                            : isCurrentPointer
                            ? 'bg-amber-400 text-slate-950 scale-110 ring-2 ring-amber-200 shadow-md font-black'
                            : 'bg-white/10 text-gray-300'
                        }`}
                      >
                        {p.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ────── STAGE 3: 최종 당첨 발표 피날레 팝업 ────── */}
          {stage === 'finished' && (
            <div className="text-center py-2">
              {/* 상단 축하 폭죽 아이콘 연출 */}
              <div className="flex items-center justify-center gap-3 text-3xl sm:text-4xl mb-3 animate-bounce">
                <span>🎊</span>
                <span>🍗</span>
                <span>🏆</span>
                <span>🍗</span>
                <span>🎉</span>
              </div>

              <div className="inline-block px-4 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs sm:text-sm mb-3 shadow-md">
                ✨ REVIEW EVENT WINNER ✨
              </div>

              {/* 메인 당첨 선언 박스 (요구사항 문구 명확히 표시) */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-400/20 via-rose-500/20 to-amber-400/20 border-2 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.3)] mb-6">
                <h3 className="text-2xl sm:text-4xl font-black text-amber-300 tracking-tight mb-3 drop-shadow">
                  🎉 축당첨! 🎉
                </h3>
                <p className="text-base sm:text-xl font-extrabold text-white leading-relaxed break-keep">
                  축당첨! 이번 치킨당첨자는{' '}
                  <span className="text-amber-300 underline decoration-amber-400 decoration-2 underline-offset-4 font-black text-xl sm:text-2xl">
                    {winnersText}
                  </span>{' '}
                  입니다.
                </p>
              </div>

              {/* 개별 당첨자 골드 티켓 카드 목록 */}
              <div
                className={`grid gap-3 mb-6 ${
                  confirmedWinners.length === 1
                    ? 'grid-cols-1 max-w-sm mx-auto'
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {confirmedWinners.map((winner, idx) => (
                  <div
                    key={winner.id}
                    className="relative flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-slate-950 shadow-lg border-2 border-white"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-950 text-amber-300 font-black text-sm flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="text-left">
                        <p className="text-[10px] font-extrabold text-slate-700 uppercase">
                          치킨 기프티콘 당첨자
                        </p>
                        <p className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
                          {winner.label}
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl">🍗</span>
                  </div>
                ))}
              </div>

              {/* 전체 응모자 명단 확인 토글 (영상 투명성 확보용) */}
              <div className="mb-6">
                <button
                  onClick={() => setShowFullPool((prev) => !prev)}
                  className="text-xs font-bold text-indigo-200 hover:text-amber-300 underline underline-offset-4 transition-colors"
                >
                  {showFullPool
                    ? '▲ 추첨 대상 전체 명단 접기'
                    : `▼ 추첨 대상 전체 명단 보기 (총 ${participants.length}명)`}
                </button>
                {showFullPool && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-black/40 border border-white/10 text-left max-h-32 overflow-y-auto text-xs text-gray-300 leading-relaxed">
                    {participants.map((p) => p.label).join(', ')}
                  </div>
                )}
              </div>

              {/* 하단 액션 버튼 모음 */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  onClick={handleCopyWinners}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-lg transition-all active:scale-95"
                >
                  📋 당첨 발표 문구 복사하기
                </button>
                <button
                  onClick={handleCopyAllParticipants}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/15 transition-all"
                >
                  📋 전체 응모명단 복사
                </button>
                <button
                  onClick={startRaffleSequence}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-all"
                >
                  🔄 다시 추첨하기
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 font-bold text-sm transition-all"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';

/**
 * CalendarView — 순수 React 월간 캘린더 컴포넌트
 * 
 * 왜 외부 라이브러리 없이 만드는가:
 * - 이 앱은 PWA 기반 모바일 앱으로 번들 크기가 중요
 * - 필요한 기능이 "월간 그리드 + 날짜별 건수 + 클릭 상세"로 제한적
 * - Tailwind 스타일과 완벽히 통합하기 위해 직접 구현
 */

// 수거 요청 아이템 타입 (AdminDashboard/DriverDashboard와 공유)
interface CalendarRequestItem {
  id: string;
  userName: string;
  phone: string;
  address: string;
  detailAddress: string;
  estimatedVolume: string;
  status: string;
  desiredDate?: string | Date;
  confirmedDate?: string | Date | null;
  isMustPickupDate?: boolean;
  driverId?: string | null;
  actualWeight?: number;
  totalPrice?: number;
}

interface CalendarViewProps {
  requests: CalendarRequestItem[];
  onRequestClick?: (request: CalendarRequestItem) => void;
  compact?: boolean;
  onUpdateDate?: (requestId: string, dateStr: string) => void;
  onBulkAssignClick?: (selectedIds: string[]) => void;
}

// 상태별 색상 맵 (뱃지 UI에 사용)
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-orange-100', text: 'text-orange-700', label: '대기' },
  ASSIGNED: { bg: 'bg-blue-100', text: 'text-blue-700', label: '배정' },
  SCHEDULED: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: '예정' },
  IN_PROGRESS: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: '진행' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: '완료' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500', label: '취소' },
};

// 날짜를 'YYYY-MM-DD' 문자열로 변환하는 유틸 (타임존 안전)
const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function CalendarView({ requests, onRequestClick, compact = false, onUpdateDate, onBulkAssignClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // 기사 배정 인라인 UI를 위한 상태
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ driverId: '', dateStr: '' });
  
  // 일괄 배정을 위한 체크박스 상태
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  // selectedDate가 변경될 때 체크박스 초기화
  useEffect(() => {
    setCheckedIds([]);
  }, [selectedDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 현재 월의 캘린더 그리드 생성 (6주 x 7일)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay(); // 0(일) ~ 6(토)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // 이전 달 마지막 며칠
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ 
        date: new Date(year, month - 1, daysInPrevMonth - i), 
        isCurrentMonth: false 
      });
    }
    
    // 현재 달
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // 다음 달 (총 42일 = 6주를 채우기 위해)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  }, [year, month]);

  // 수거 요청을 confirmedDate || desiredDate 기준으로 날짜별 그룹핑
  const requestsByDate = useMemo(() => {
    const map: Record<string, CalendarRequestItem[]> = {};
    requests.forEach(req => {
      const targetDate = req.confirmedDate || req.desiredDate;
      if (!targetDate) return;
      const key = toDateKey(new Date(targetDate));
      if (!map[key]) map[key] = [];
      map[key].push(req);
    });
    return map;
  }, [requests]);

  // 오늘 날짜 키
  const todayKey = toDateKey(new Date());

  // 이전/다음 달 이동
  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayKey);
  };

  // 선택된 날짜의 수거 건 목록
  const selectedRequests = selectedDate ? (requestsByDate[selectedDate] || []) : [];
  // 상태별 필터
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const filteredSelectedRequests = statusFilter === 'ALL' 
    ? selectedRequests 
    : selectedRequests.filter(r => r.status === statusFilter);

  // 선택된 날짜 표시용 포맷
  const formatSelectedDate = (dateKey: string) => {
    const d = new Date(dateKey + 'T00:00:00');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
  };

  // 날짜별 상태 카운트 계산
  const getStatusCounts = (dateRequests: CalendarRequestItem[]) => {
    const counts: Record<string, number> = {};
    dateRequests.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  };

  const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-4">
      {/* 캘린더 헤더: 월 선택 + 네비게이션 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={goToPrevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 font-bold"
          >
            ◀
          </button>
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-gray-900">
              {year}년 {month + 1}월
            </h2>
            <button 
              onClick={goToToday}
              className="text-xs text-blue-600 font-bold hover:underline mt-0.5"
            >
              오늘로 이동
            </button>
          </div>
          <button 
            onClick={goToNextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 font-bold"
          >
            ▶
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayHeaders.map((day, i) => (
            <div 
              key={day} 
              className={`text-center text-[10px] font-bold py-1 ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 캘린더 그리드 */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const dateKey = toDateKey(date);
            const dateRequests = requestsByDate[dateKey] || [];
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;
            const dayOfWeek = date.getDay();
            const statusCounts = getStatusCounts(dateRequests);
            const totalCount = dateRequests.length;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                className={`
                  relative flex flex-col items-center justify-start rounded-xl transition-all
                  ${compact ? 'min-h-[52px] p-1' : 'min-h-[64px] p-1.5'}
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-blue-50 ring-2 ring-blue-400 shadow-sm' : 'hover:bg-gray-50'}
                  ${isToday && !isSelected ? 'ring-2 ring-blue-300 bg-blue-50/50' : ''}
                `}
              >
                {/* 날짜 숫자 */}
                <span className={`text-xs font-bold leading-none ${
                  isToday ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 
                  dayOfWeek === 0 ? 'text-red-500' : 
                  dayOfWeek === 6 ? 'text-blue-500' : 
                  'text-gray-700'
                }`}>
                  {date.getDate()}
                </span>

                {/* 건수 뱃지 */}
                {totalCount > 0 && (
                  <div className="mt-0.5 flex flex-wrap justify-center gap-[1px]">
                    {/* 대기/미배정: 주황 도트 */}
                    {(statusCounts['PENDING'] || 0) > 0 && (
                      <span className="w-[6px] h-[6px] rounded-full bg-orange-400" title={`대기 ${statusCounts['PENDING']}건`} />
                    )}
                    {/* 배정/진행: 파란 도트 */}
                    {((statusCounts['ASSIGNED'] || 0) + (statusCounts['SCHEDULED'] || 0) + (statusCounts['IN_PROGRESS'] || 0)) > 0 && (
                      <span className="w-[6px] h-[6px] rounded-full bg-blue-500" title={`배정 ${(statusCounts['ASSIGNED'] || 0) + (statusCounts['SCHEDULED'] || 0) + (statusCounts['IN_PROGRESS'] || 0)}건`} />
                    )}
                    {/* 완료: 초록 도트 */}
                    {(statusCounts['COMPLETED'] || 0) > 0 && (
                      <span className="w-[6px] h-[6px] rounded-full bg-green-500" title={`완료 ${statusCounts['COMPLETED']}건`} />
                    )}
                    {/* 총 건수 텍스트 */}
                    <span className={`text-[8px] font-extrabold leading-none ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                      {totalCount}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-[10px] text-gray-500">대기</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] text-gray-500">배정</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] text-gray-500">완료</span>
          </div>
        </div>
      </div>

      {/* 선택된 날짜의 상세 수거 리스트 */}
      {selectedDate && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-extrabold text-gray-900">
              📋 {formatSelectedDate(selectedDate)}
            </h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              selectedRequests.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {selectedRequests.length}건
            </span>
          </div>

          {/* 상태별 필터 탭 */}
          {selectedRequests.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              <button 
                onClick={() => setStatusFilter('ALL')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  statusFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체 ({selectedRequests.length})
              </button>
              {Object.entries(getStatusCounts(selectedRequests)).map(([status, count]) => {
                const sc = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      statusFilter === status ? `${sc.bg} ${sc.text} ring-1 ring-current` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sc.label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* 수거 건 목록 */}
          {filteredSelectedRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm font-medium">해당 날짜에 수거 건이 없습니다.</p>
            </div>
          ) : (
            <>
              {onBulkAssignClick && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      checked={filteredSelectedRequests.filter(r => r.status === 'PENDING' || r.status === 'ASSIGNED').length > 0 && checkedIds.length === filteredSelectedRequests.filter(r => r.status === 'PENDING' || r.status === 'ASSIGNED').length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCheckedIds(filteredSelectedRequests.filter(r => r.status === 'PENDING' || r.status === 'ASSIGNED').map(r => r.id));
                        } else {
                          setCheckedIds([]);
                        }
                      }}
                    />
                    <span>전체 선택</span>
                  </label>
                  {checkedIds.length > 0 && (
                    <button 
                      onClick={() => onBulkAssignClick(checkedIds)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors animate-fade-in"
                    >
                      🚀 선택된 {checkedIds.length}건 방문일 일괄 변경
                    </button>
                  )}
                </div>
              )}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredSelectedRequests.map(req => {
                  const sc = STATUS_COLORS[req.status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: req.status };
                  const isSelectable = onBulkAssignClick && (req.status === 'PENDING' || req.status === 'ASSIGNED');
                  return (
                    <div 
                      key={req.id} 
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-300 transition-all cursor-pointer flex gap-3 items-start"
                      onClick={() => onRequestClick?.(req)}
                    >
                      {isSelectable && (
                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            checked={checkedIds.includes(req.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCheckedIds([...checkedIds, req.id]);
                              } else {
                                setCheckedIds(checkedIds.filter(id => id !== req.id));
                              }
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-gray-900 text-sm">{req.userName}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                            {sc.label}
                          </span>
                          {req.confirmedDate && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded" title="사장님이 방문일을 임의 변경함">
                              🔄 날짜 변경됨
                            </span>
                          )}
                          {req.isMustPickupDate && (
                            <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">
                              🚨 필수
                            </span>
                          )}
                        </div>
                        {req.confirmedDate && req.desiredDate && toDateKey(new Date(req.confirmedDate)) !== toDateKey(new Date(req.desiredDate as Date)) && (
                          <div className="text-[10px] text-purple-600 mt-1 font-bold flex items-center gap-1">
                            <span className="opacity-70 line-through">희망 {new Date(req.desiredDate as Date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric'})}</span>
                            <span>➔</span>
                            <span>확정 {new Date(req.confirmedDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric'})}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1 truncate">{req.address} {req.detailAddress}</p>
                        <span className="text-[10px] text-gray-400 font-medium">{req.estimatedVolume}</span>
                        {req.status === 'COMPLETED' && req.totalPrice != null && (
                          <span className="text-[10px] text-green-600 font-bold ml-2">
                            {req.totalPrice.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <a 
                          href={`tel:${req.phone}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-sm"
                          title="전화"
                        >
                          📞
                        </a>
                        <a 
                          href={`sms:${req.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm"
                          title="문자"
                        >
                          💬
                        </a>
                      </div>
                    </div>
                    {/* 배정 폼 인라인 렌더링 */}
                    {assigningRequestId === req.id && onUpdateDate && (
                      <div 
                        className="mt-3 p-3 bg-white rounded-lg border border-blue-200 shadow-inner"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-2">
                            {/* 담당 기사 선택 UI 제거 (배차 화면에서만 가능) */}
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">방문 확정일 (선택)</label>
                            <input 
                              type="date" 
                              value={assignForm.dateStr}
                              onChange={(e) => setAssignForm({ ...assignForm, dateStr: e.target.value })}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2 justify-end mt-1">
                            <button 
                              onClick={() => setAssigningRequestId(null)}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300"
                            >
                              취소
                            </button>
                            <button 
                              onClick={() => {
                                if (!assignForm.dateStr) return alert('변경할 방문 확정일을 선택해주세요.');
                                onUpdateDate(req.id, assignForm.dateStr);
                                setAssigningRequestId(null);
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm"
                            >
                              날짜 변경 완료
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 배정 버튼 (PENDING, ASSIGNED 상태에서만 노출) */}
                    {!assigningRequestId && (req.status === 'PENDING' || req.status === 'ASSIGNED') && onUpdateDate && (
                      <div className="mt-2 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningRequestId(req.id);
                            setAssignForm({ driverId: '', dateStr: (req.confirmedDate || req.desiredDate) ? new Date(req.confirmedDate || req.desiredDate as Date).toISOString().split('T')[0] : '' });
                          }}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                        >
                          📅 방문일 변경
                        </button>
                      </div>
                    )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 이번 달 요약 통계 */}
      {!selectedDate && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">📊 {month + 1}월 수거 요약</h3>
          {(() => {
            // 현재 월의 요청만 필터링 (confirmedDate 우선)
            const monthRequests = requests.filter(r => {
              const targetDate = r.confirmedDate || r.desiredDate;
              if (!targetDate) return false;
              const d = new Date(targetDate);
              return d.getFullYear() === year && d.getMonth() === month;
            });
            const statusCounts = getStatusCounts(monthRequests);
            const totalCount = monthRequests.length;
            
            if (totalCount === 0) {
              return <p className="text-sm text-gray-400 text-center py-4">이번 달 수거 건이 없습니다.</p>;
            }

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-gray-900">{totalCount}</p>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">전체</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-orange-600">{statusCounts['PENDING'] || 0}</p>
                  <p className="text-[10px] text-orange-600 font-medium mt-0.5">대기</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-blue-600">
                    {(statusCounts['ASSIGNED'] || 0) + (statusCounts['SCHEDULED'] || 0) + (statusCounts['IN_PROGRESS'] || 0)}
                  </p>
                  <p className="text-[10px] text-blue-600 font-medium mt-0.5">배정/진행</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-green-600">{statusCounts['COMPLETED'] || 0}</p>
                  <p className="text-[10px] text-green-600 font-medium mt-0.5">완료</p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

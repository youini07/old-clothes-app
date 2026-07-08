import React, { useState, useRef, useEffect } from 'react';
interface Props {
  value: string;
  onChange: (val: string) => void;
  completedRequests: any[]; 
}

export default function CompletedDatePicker({ value, onChange, completedRequests }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  // Count completions per date
  const countsByDate = completedRequests.reduce((acc, req) => {
    if (!req.completedDate) return acc;
    const dateStr = new Date(req.completedDate).toLocaleDateString('en-CA');
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        type="button"
        onClick={handleToggle}
        className="text-xs border border-gray-300 rounded-md px-3 py-1.5 outline-none hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 text-gray-700 bg-white font-bold flex items-center gap-2 shadow-sm transition-all"
      >
        📅 {value}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 p-3 bg-white border border-gray-200 shadow-xl rounded-xl z-50 w-[260px] animate-fade-in origin-top-right">
          <div className="flex justify-between items-center mb-3">
            <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors">◀</button>
            <span className="font-extrabold text-sm text-gray-800">{year}년 {month + 1}월</span>
            <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors">▶</button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-2">
            <div className="text-red-400">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400">토</div>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (!day) return <div key={idx} className="p-2"></div>;
              
              const dateStr = day.toLocaleDateString('en-CA');
              const count = countsByDate[dateStr] || 0;
              const isSelected = dateStr === value;
              const isToday = dateStr === new Date().toLocaleDateString('en-CA');

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(dateStr);
                    setIsOpen(false);
                  }}
                  className={`
                    relative p-1 flex flex-col items-center justify-center rounded-lg transition-all min-h-[42px]
                    ${isSelected ? 'bg-primary-500 text-white shadow-md scale-105' : 'hover:bg-gray-100 text-gray-700'}
                    ${isToday && !isSelected ? 'border border-primary-300 bg-primary-50 text-primary-700' : ''}
                  `}
                >
                  <span className={`text-[11px] font-bold ${day.getDay()===0 && !isSelected?'text-red-500':''} ${day.getDay()===6 && !isSelected?'text-blue-500':''}`}>
                    {day.getDate()}
                  </span>
                  {count > 0 && (
                    <span className={`text-[9px] font-extrabold mt-0.5 px-1 rounded-sm ${isSelected ? 'text-primary-100' : 'text-green-600 bg-green-50'}`}>
                      {count}건
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';

export type DayStatus = 'green' | 'yellow' | 'red' | 'none';

export type CalendarProps = {
  year: number;
  month: number; // 0-11
  statusByDate: Record<string, DayStatus>;
  countsByDate?: Record<string, number>;
  tiffinByDate?: Record<string, { lunch?: 'received' | 'skipped'; dinner?: 'received' | 'skipped' }>;
  onSelect: (date: Date) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onToday?: () => void;
  today?: Date;
  selected?: Date | null;
  selectedDates?: Date[];
  weekStart?: 'mon' | 'sun';
  onDropTask?: (targetDate: Date, data: { fromKey: string; taskId: string }) => void;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Calendar({ year, month, statusByDate, countsByDate, tiffinByDate, onSelect, onPrevMonth, onNextMonth, onToday, today, selected, selectedDates, weekStart = 'mon', onDropTask }: CalendarProps) {
  const { weeks, label, headers } = useMemo(() => {
    const first = startOfMonth(new Date(year, month, 1));
    const last = endOfMonth(new Date(year, month, 1));
    const startWeekday = weekStart === 'mon' ? (first.getDay() + 6) % 7 : first.getDay();
    const daysInMonth = last.getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const label = new Date(year, month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const headers = weekStart === 'mon' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return { weeks, label, headers };
  }, [year, month, weekStart]);

  const selectedKeySet = useMemo(() => new Set((selectedDates || []).map(d => dateKey(d))), [selectedDates]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10">
      <div className="p-3 md:p-4 border-b dark:border-gray-700 flex items-center justify-between gap-3 md:gap-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-t-xl">
        <div className="flex items-center gap-2">
          <button
            className="w-9 h-9 rounded-full border hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 shadow-sm"
            onClick={onPrevMonth}
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="font-semibold min-w-[12ch] text-center text-sm md:text-base">{label}</div>
          <button
            className="w-9 h-9 rounded-full border hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 shadow-sm"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-2 md:gap-3">
          <button
            className="px-3 py-1 rounded-full border hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 shadow-sm"
            onClick={onToday}
          >Today</button>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"/> All done</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"/> Some pending</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/> None done</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title="Lunch indicator"><span className="inline-block text-base">🍱</span> Lunch</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" title="Dinner indicator"><span className="inline-block text-base">🍽️</span> Dinner</span>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] md:text-xs text-gray-500 dark:text-gray-400 px-3 md:px-4 pt-2 md:pt-3">
        {headers.map(h => (<div key={h}>{h}</div>))}
      </div>
      <div className="px-2 pb-4">
        {weeks.map((w, i) => (
          <div className="grid grid-cols-7 gap-1 mt-1 md:gap-1.5" key={i}>
            {w.map((d, j) => {
              if (!d) return <div key={j} className="h-16"/>;
              const key = dateKey(d);
              const status = statusByDate[key] || 'none';
              const color = status === 'green' ? 'bg-green-500' : status === 'yellow' ? 'bg-yellow-400' : status === 'red' ? 'bg-red-500' : '';
              const isToday = !!today && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
              const isFuture = !!today && new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
              const isSelected = selectedDates && selectedDates.length > 0
                ? selectedKeySet.has(key)
                : (!!selected && d.getFullYear() === selected.getFullYear() && d.getMonth() === selected.getMonth() && d.getDate() === selected.getDate());
              const count = countsByDate?.[key] ?? 0;
              const tiff = tiffinByDate?.[key];
              const base = 'h-16 md:h-20 rounded-xl border dark:border-gray-700 flex items-center justify-center relative text-gray-900 dark:text-gray-100 shadow-sm transition-all hover:shadow-md';
              let bg = 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700';
              let borderTint = '';
              const anyReceived = tiff?.lunch === 'received' || tiff?.dinner === 'received';
              const anySkipped = tiff?.lunch === 'skipped' || tiff?.dinner === 'skipped';
              if (anyReceived) {
                bg = 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/40';
                borderTint = ' border-emerald-200 dark:border-emerald-400/30';
              } else if (anySkipped) {
                bg = 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-800/40';
                borderTint = ' border-rose-200 dark:border-rose-400/30';
              }
              const ringCls = (isSelected || isToday) ? ' ring-2 ring-blue-400' : '';
              if (isSelected) bg = 'bg-blue-50 dark:bg-blue-900/30';
              const disabledCls = isFuture ? ' cursor-not-allowed opacity-60' : '';
              const btnClass = `${base} ${bg}${borderTint}${ringCls}${disabledCls}`;
              return (
                <button
                  key={j}
                  onClick={() => { if (isFuture) return; onSelect(d); }
}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    if (!onDropTask) return;
                    try {
                      const raw = e.dataTransfer.getData('application/json');
                      const parsed = JSON.parse(raw) as { fromKey: string; taskId: string };
                      if (parsed?.fromKey && parsed?.taskId) onDropTask(d, parsed);
                    } catch {}
                  }}
                  className={btnClass}
                >
                  <span className="hidden md:inline text-sm">{d.getDate()}</span>
                  {color && <span className={`absolute bottom-1 w-3 h-3 md:w-4 md:h-4 rounded-full ${color}`}></span>}
                  {count > 0 && (
                    <span className="absolute top-1 right-1 text-[10px] leading-none rounded-full px-1.5 py-0.5 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100" title={`${count} task${count===1?'':'s'}`}>{count}</span>
                  )}
                  {/* Mobile: center vertical stack of [lunch][date][dinner] */}
                  <div className="absolute inset-0 md:hidden flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                    {tiff?.lunch && (
                      <span className={`${tiff.lunch === 'received' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'} inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs leading-none`}>{tiff.lunch === 'received' ? '🍱' : '🚫'}</span>
                    )}
                    <span className="text-xs">{d.getDate()}</span>
                    {tiff?.dinner && (
                      <span className={`${tiff.dinner === 'received' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'} inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs leading-none`}>{tiff.dinner === 'received' ? '🍽️' : '🚫'}</span>
                    )}
                  </div>
                  {(tiff?.lunch || tiff?.dinner) && (
                    <>
                      {tiff?.lunch && (
                        <span
                          title={tiff.lunch === 'received' ? 'Lunch received' : 'Lunch skipped'}
                          className={`hidden md:inline-flex absolute top-1 left-1 items-center justify-center rounded-full px-2 py-1 text-lg leading-none ${tiff.lunch === 'received' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'}`}
                          aria-label={tiff.lunch === 'received' ? 'Lunch received' : 'Lunch skipped'}
                        >
                          {tiff.lunch === 'received' ? '🍱' : '🚫'}
                        </span>
                      )}
                      {tiff?.dinner && (
                        <span
                          title={tiff.dinner === 'received' ? 'Dinner received' : 'Dinner skipped'}
                          className={`hidden md:inline-flex absolute top-1 right-1 items-center justify-center rounded-full px-2 py-1 text-lg leading-none ${tiff.dinner === 'received' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'}`}
                          aria-label={tiff.dinner === 'received' ? 'Dinner received' : 'Dinner skipped'}
                        >
                          {tiff.dinner === 'received' ? '🍽️' : '🚫'}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export { dateKey };

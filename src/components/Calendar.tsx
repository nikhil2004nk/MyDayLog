import { useMemo } from 'react';

export type DayStatus = 'green' | 'yellow' | 'red' | 'none';

export type CalendarProps = {
  year: number;
  month: number; // 0-11
  statusByDate: Record<string, DayStatus>;
  countsByDate?: Record<string, number>;
  tiffinByDate?: Record<string, 'received' | 'skipped'>;
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            className="w-8 h-8 rounded border hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
            onClick={onPrevMonth}
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="font-semibold min-w-[10ch] text-center">{label}</div>
          <button
            className="w-8 h-8 rounded border hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
          <button
            className="px-2 py-1 rounded border hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
            onClick={onToday}
          >Today</button>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/> All done</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/> Some pending</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> None done</span>
          <span className="inline-flex items-center gap-1" title="Tiffin received"><span aria-hidden className="inline-block text-base">🍱</span> Tiffin received</span>
          <span className="inline-flex items-center gap-1" title="Tiffin skipped"><span aria-hidden className="inline-block text-base">🚫</span> Tiffin skipped</span>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-500 dark:text-gray-400 px-4 pt-3">
        {headers.map(h => (<div key={h}>{h}</div>))}
      </div>
      <div className="px-2 pb-4">
        {weeks.map((w, i) => (
          <div className="grid grid-cols-7 gap-1 mt-1" key={i}>
            {w.map((d, j) => {
              if (!d) return <div key={j} className="h-16"/>;
              const key = dateKey(d);
              const status = statusByDate[key] || 'none';
              const color = status === 'green' ? 'bg-green-500' : status === 'yellow' ? 'bg-yellow-400' : status === 'red' ? 'bg-red-500' : '';
              const isToday = !!today && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
              const isSelected = selectedDates && selectedDates.length > 0
                ? selectedKeySet.has(key)
                : (!!selected && d.getFullYear() === selected.getFullYear() && d.getMonth() === selected.getMonth() && d.getDate() === selected.getDate());
              const count = countsByDate?.[key] ?? 0;
              const tiffin = tiffinByDate?.[key];
              const base = 'h-16 rounded border dark:border-gray-700 flex items-center justify-center relative text-gray-900 dark:text-gray-100';
              let bg = 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700';
              let borderTint = '';
              if (tiffin === 'received') {
                bg = 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/40';
                borderTint = ' border-emerald-200 dark:border-emerald-400/30';
              } else if (tiffin === 'skipped') {
                bg = 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-800/40';
                borderTint = ' border-rose-200 dark:border-rose-400/30';
              }
              const ringCls = (isSelected || isToday) ? ' ring-2 ring-blue-400' : '';
              if (isSelected) bg = 'bg-blue-50 dark:bg-blue-900/30';
              const btnClass = `${base} ${bg}${borderTint}${ringCls}`;
              return (
                <button
                  key={j}
                  onClick={() => onSelect(d)
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
                  <span className="text-sm">{d.getDate()}</span>
                  {color && <span className={`absolute bottom-1 w-2 h-2 rounded-full ${color}`}></span>}
                  {count > 0 && (
                    <span className="absolute top-1 right-1 text-[10px] leading-none rounded-full px-1.5 py-0.5 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100" title={`${count} task${count===1?'':'s'}`}>{count}</span>
                  )}
                  {tiffin && (
                    <span
                      title={tiffin === 'received' ? 'Tiffin received' : 'Tiffin skipped'}
                      className="absolute top-1 left-1 text-xl leading-none"
                      role="img"
                      aria-label={tiffin === 'received' ? 'Tiffin received' : 'Tiffin skipped'}
                    >
                      {tiffin === 'received' ? '🍱' : '🚫'}
                    </span>
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

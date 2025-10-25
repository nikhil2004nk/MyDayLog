import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../auth/AuthContext';
import Calendar, { dateKey } from '../components/Calendar';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import FadeIn from '../components/FadeIn';

const PROFILE_KEY = 'mydaylog_profile';
const TIFFIN_KEY = 'mydaylog_tiffin';

type MealStatus = 'received' | 'skipped';
type TiffinEntry = {
  status?: MealStatus;
  reason?: string;
};
type TiffinDay = {
  lunch?: TiffinEntry;
  dinner?: TiffinEntry;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [showSettings, setShowSettings] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const { theme, setTheme, toggleTheme } = useTheme();
  const [weekStart, setWeekStart] = useState<'mon' | 'sun'>('mon');
  const [tiffinMap, setTiffinMap] = useState<Record<string, TiffinDay>>({});
  const [tiffinReminderEnabled, setTiffinReminderEnabled] = useState(false);
  const [tiffinReminderTime, setTiffinReminderTime] = useState<string>('12:30');
  const [bulkTiffinMode, setBulkTiffinMode] = useState(false);
  const [bulkMeal, setBulkMeal] = useState<'lunch' | 'dinner' | null>(null);
  const [bulkSelectedDates, setBulkSelectedDates] = useState<Date[]>([]);
  const [bulkAnchorDate, setBulkAnchorDate] = useState<Date | null>(null);
  const [bulkDraft, setBulkDraft] = useState<{ lunch: Record<string, 'received'|'skipped'|'clear'>; dinner: Record<string, 'received'|'skipped'|'clear'> }>({ lunch: {}, dinner: {} });

  useEffect(() => {
    // restore view month if present
    try {
      const raw = localStorage.getItem('mydaylog_view_month');
      if (raw) {
        const { y, m } = JSON.parse(raw) as { y: number; m: number };
        if (typeof y === 'number' && typeof m === 'number') {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    } catch {}
    // restore profile
    try {
      const p = localStorage.getItem(PROFILE_KEY);
      if (p) {
        const parsed = JSON.parse(p) as { displayName?: string; theme?: 'light'|'dark'; weekStart?: 'mon'|'sun' };
        if (parsed.displayName) setDisplayName(parsed.displayName);
        if (parsed.theme === 'dark' || parsed.theme === 'light') setTheme(parsed.theme);
        if (parsed.weekStart === 'mon' || parsed.weekStart === 'sun') setWeekStart(parsed.weekStart);
      }
    } catch {}
    // restore tiffin map (migrate old single-entry per day to lunch entry)
    try {
      const t = localStorage.getItem(TIFFIN_KEY);
      if (t) {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object') {
          const fixed: Record<string, TiffinDay> = {};
          Object.entries(parsed).forEach(([k, v]) => {
            // If already in new shape
            if (v && typeof v === 'object' && ('lunch' in (v as any) || 'dinner' in (v as any))) {
              fixed[k] = v as TiffinDay;
            } else if (typeof v === 'string') {
              fixed[k] = { lunch: { status: v as any } };
            } else if (v && typeof v === 'object' && 'status' in (v as any)) {
              fixed[k] = { lunch: v as TiffinEntry };
            }
          });
          setTiffinMap(fixed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('mydaylog_view_month', JSON.stringify({ y: viewYear, m: viewMonth }));
  }, [viewYear, viewMonth]);

  // Theme side-effects handled by ThemeProvider now

  useEffect(() => {
    // persist tiffin map
    localStorage.setItem(TIFFIN_KEY, JSON.stringify(tiffinMap));
  }, [tiffinMap]);

  // reminder scheduler (simple in-app reminder)
  useEffect(() => {
    const REM_KEY = 'mydaylog_tiffin_reminder_last';
    if (!tiffinReminderEnabled) return;
    const id = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeNow = `${hh}:${mm}`;
      if (timeNow !== tiffinReminderTime) return;
      const todayKey = dateKey(now);
      const last = localStorage.getItem(REM_KEY);
      const entry = tiffinMap[todayKey];
      const lunchSet = !!entry?.lunch?.status;
      const dinnerSet = !!entry?.dinner?.status;
      if (!lunchSet || !dinnerSet) {
        if (last !== todayKey) {
          setToastMsg("Don't forget to set today's meals ");
          localStorage.setItem(REM_KEY, todayKey);
        }
      }
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [tiffinReminderEnabled, tiffinReminderTime, tiffinMap]);

  const year = viewYear;
  const month = viewMonth;

  // Tiffin stats (separate lunch and dinner)
  const monthTiffin = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const calc = (meal: 'lunch' | 'dinner') => {
      let received = 0, skipped = 0;
      for (let d = 1; d <= totalDays; d++) {
        const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const entry = tiffinMap[k]?.[meal];
        if (entry?.status === 'received') received += 1;
        else if (entry?.status === 'skipped') skipped += 1;
      }
      const unset = Math.max(0, totalDays - (received + skipped));
      const pct = totalDays ? Math.round((received / totalDays) * 100) : 0;
      return { received, skipped, unset, total: totalDays, pct };
    };
    return { lunch: calc('lunch'), dinner: calc('dinner') };
  }, [tiffinMap, year, month]);

  const weekTiffin = useMemo(() => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const offset = weekStart === 'mon' ? (day === 0 ? 6 : day - 1) : day;
    const start = new Date(today);
    start.setDate(today.getDate() - offset);
    const total = 7;
    const calc = (meal: 'lunch' | 'dinner') => {
      let received = 0, skipped = 0;
      for (let i = 0; i < total; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const k = dateKey(d);
        const entry = tiffinMap[k]?.[meal];
        if (entry?.status === 'received') received += 1;
        else if (entry?.status === 'skipped') skipped += 1;
      }
      const unset = Math.max(0, total - (received + skipped));
      const pct = total ? Math.round((received / total) * 100) : 0;
      return { received, skipped, unset, total, pct };
    };
    return { lunch: calc('lunch'), dinner: calc('dinner') };
  }, [tiffinMap, weekStart]);

  const mealsStreakBoth = useMemo(() => {
    let streak = 0;
    let d = new Date();
    while (true) {
      const k = dateKey(d);
      const day = tiffinMap[k];
      const bothReceived = day?.lunch?.status === 'received' && day?.dinner?.status === 'received';
      if (bothReceived) {
        streak += 1;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [tiffinMap]);

  const openDaily = (d: Date) => {
    setSelectedDate(d);
  };

  const setTiffinFor = (k: string, meal: 'lunch' | 'dinner', status: MealStatus | 'clear') => {
    setTiffinMap(prev => {
      const day = { ...(prev[k] || {}) } as TiffinDay;
      if (status === 'clear') {
        delete (day as any)[meal];
      } else {
        day[meal] = { ...(day[meal] || {}), status };
      }
      const next = { ...prev } as Record<string, TiffinDay>;
      // If both meals are cleared, remove the day entirely
      if (!day.lunch && !day.dinner) delete next[k]; else next[k] = day;
      return next;
    });
    setToastMsg('Meal status updated ');
  };

  const setTiffinReason = (k: string, meal: 'lunch' | 'dinner', reason: string) => {
    setTiffinMap(prev => {
      const day = { ...(prev[k] || {}) } as TiffinDay;
      day[meal] = { ...(day[meal] || {}), reason };
      return { ...prev, [k]: day };
    });
  };

  

  const applyBulkTiffin = (meal: 'lunch' | 'dinner', status: 'received' | 'skipped' | 'clear') => {
    if (bulkSelectedDates.length === 0) return;
    setBulkDraft(prev => {
      const copy = { lunch: { ...prev.lunch }, dinner: { ...prev.dinner } } as { lunch: Record<string, 'received'|'skipped'|'clear'>; dinner: Record<string, 'received'|'skipped'|'clear'> };
      bulkSelectedDates.forEach(d => {
        const k = dateKey(d);
        copy[meal][k] = status;
      });
      return copy;
    });
  };

  const commitBulkDraft = () => {
    const hasDraft = Object.keys(bulkDraft.lunch).length > 0 || Object.keys(bulkDraft.dinner).length > 0;
    if (!hasDraft) return;
    setTiffinMap(prev => {
      const next: Record<string, TiffinDay> = { ...prev };
      const applyMeal = (meal: 'lunch'|'dinner', map: Record<string, 'received'|'skipped'|'clear'>) => {
        Object.entries(map).forEach(([k, st]) => {
          const day = { ...(next[k] || {}) } as TiffinDay;
          if (st === 'clear') {
            delete (day as any)[meal];
          } else {
            day[meal] = { ...(day[meal] || {}), status: st } as any;
          }
          if (!day.lunch && !day.dinner) delete next[k]; else next[k] = day;
        });
      };
      applyMeal('lunch', bulkDraft.lunch);
      applyMeal('dinner', bulkDraft.dinner);
      return next;
    });
    setToastMsg('Meal statuses updated ');
    setBulkDraft({ lunch: {}, dinner: {} });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">Hey {user?.guest ? 'there' : (user?.identifier?.split('@')[0] || 'there')} 👋</div>
          <div className="flex items-center gap-3">
            <button className="text-sm text-gray-600 dark:text-gray-300" onClick={logout}>Logout</button>
            <button
              className="relative inline-flex h-5 w-9 items-center rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; console.log('[theme:toggle] header switch ->', next); toggleTheme(); }}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-gray-400 dark:bg-gray-300 transition ${theme === 'dark' ? 'translate-x-4' : 'translate-x-1'}`}/>
            </button>
            <button className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" onClick={() => setShowSettings(true)} aria-label="Open settings"/>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-base font-semibold">Meals Stats</div>
            <div className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Streak (both meals): {mealsStreakBoth} day{mealsStreakBoth===1?'':'s'}</div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:[grid-template-columns:1fr_1px_1fr]">
            {/* Column: Lunch */}
            <div>
              <div className="mb-2 text-base md:text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2"><span></span><span>Lunch</span></div>
              {/* Week - Lunch */}
              <div className="rounded-xl border dark:border-gray-700 p-3 bg-gradient-to-br from-emerald-50/60 to-white dark:from-gray-800 dark:to-gray-800 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"> <span>This Week</span></div>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Received {weekTiffin.lunch.received}/7</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">Skipped {weekTiffin.lunch.skipped}</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Unset {weekTiffin.lunch.unset}</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Rate {weekTiffin.lunch.pct}%</span>
                </div>
                <div className="mt-2 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, weekTiffin.lunch.pct))}%` }} />
                </div>
              </div>
              {/* Month - Lunch */}
              <div className="rounded-xl border dark:border-gray-700 p-3 bg-gradient-to-br from-emerald-50/60 to-white dark:from-gray-800 dark:to-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"> <span>This Month</span></div>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Received {monthTiffin.lunch.received}/{new Date(year, month + 1, 0).getDate()}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">Skipped {monthTiffin.lunch.skipped}</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Unset {monthTiffin.lunch.unset}</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Rate {monthTiffin.lunch.pct}%</span>
                </div>
                <div className="mt-2 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, monthTiffin.lunch.pct))}%` }} />
                </div>
              </div>
            </div>
            {/* Divider */}
            <div className="hidden md:block bg-gray-200 dark:bg-gray-700 rounded-full w-px" />
            {/* Column: Dinner */}
            <div>
              <div className="mb-2 text-base md:text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2"><span></span><span>Dinner</span></div>
              {/* Week - Dinner */}
              <div className="rounded-xl border dark:border-gray-700 p-3 bg-gradient-to-br from-indigo-50/60 to-white dark:from-gray-800 dark:to-gray-800 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"> <span>This Week</span></div>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Received {weekTiffin.dinner.received}/7</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">Skipped {weekTiffin.dinner.skipped}</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Unset {weekTiffin.dinner.unset}</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Rate {weekTiffin.dinner.pct}%</span>
                </div>
                <div className="mt-2 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, weekTiffin.dinner.pct))}%` }} />
                </div>
              </div>
              {/* Month - Dinner */}
              <div className="rounded-xl border dark:border-gray-700 p-3 bg-gradient-to-br from-indigo-50/60 to-white dark:from-gray-800 dark:to-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"> <span>This Month</span></div>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Received {monthTiffin.dinner.received}/{new Date(year, month + 1, 0).getDate()}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">Skipped {monthTiffin.dinner.skipped}</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Unset {monthTiffin.dinner.unset}</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Rate {monthTiffin.dinner.pct}%</span>
                </div>
                <div className="mt-2 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, monthTiffin.dinner.pct))}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mb-4 rounded-xl border bg-white/70 dark:bg-gray-800/60 dark:border-gray-700 px-4 py-3 shadow-sm">
          {!bulkTiffinMode ? (
            <button
              className="px-4 py-1.5 rounded-full border dark:border-gray-700 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm"
              onClick={() => { setBulkTiffinMode(true); setBulkSelectedDates([]); setBulkMeal(null); setBulkAnchorDate(null); setBulkDraft({ lunch: {}, dinner: {} }); }}
            > Bulk set Meals</button>
          ) : (
            <div className="flex flex-col gap-3 md:gap-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm inline-flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {bulkSelectedDates.length} date{bulkSelectedDates.length===1?'':'s'} selected
                    </span>
                  </span>
                  {bulkSelectedDates.length === 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Tip: tap dates in the calendar to select them</span>
                  )}
                </div>
                {bulkSelectedDates.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base text-gray-600 dark:text-gray-300 font-medium">Select : </span>
                  <button
                    aria-pressed={bulkMeal==='lunch'}
                    className={`px-3 py-1.5 text-sm rounded-full border shadow-sm transition relative ${bulkMeal==='lunch'?'bg-emerald-50 text-emerald-800 ring-2 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700':'bg-white dark:bg-gray-800 dark:text-gray-200'} dark:border-gray-700`}
                    onClick={() => setBulkMeal('lunch')}
                  > Lunch</button>
                  <button
                    aria-pressed={bulkMeal==='dinner'}
                    className={`px-3 py-1.5 text-sm rounded-full border shadow-sm transition relative ${bulkMeal==='dinner'?'bg-indigo-50 text-indigo-800 ring-2 ring-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-700':'bg-white dark:bg-gray-800 dark:text-gray-200'} dark:border-gray-700`}
                    onClick={() => setBulkMeal('dinner')}
                  > Dinner</button>
                </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  {bulkSelectedDates.length > 0 && bulkMeal && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Perform Action :</span>
                  )}
                  <button
                    disabled={bulkSelectedDates.length===0 || !bulkMeal}
                    title={bulkSelectedDates.length===0 ? 'Select at least one date' : undefined}
                    className={`px-4 py-1.5 rounded-full shadow-sm ${bulkSelectedDates.length===0 || !bulkMeal ? 'opacity-60 cursor-not-allowed bg-emerald-600 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    onClick={() => { if (bulkMeal) applyBulkTiffin(bulkMeal, 'received'); }}
                  > Mark Received</button>
                  <button
                    disabled={bulkSelectedDates.length===0 || !bulkMeal}
                    title={bulkSelectedDates.length===0 ? 'Select at least one date' : undefined}
                    className={`px-4 py-1.5 rounded-full shadow-sm ${bulkSelectedDates.length===0 || !bulkMeal ? 'opacity-60 cursor-not-allowed bg-rose-600 text-white' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                    onClick={() => { if (bulkMeal) applyBulkTiffin(bulkMeal, 'skipped'); }}
                  > Mark Skipped</button>
                  <button
                    disabled={bulkSelectedDates.length===0 || !bulkMeal}
                    title={bulkSelectedDates.length===0 ? 'Select at least one date' : undefined}
                    className={`px-4 py-1.5 rounded-full border dark:border-gray-700 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 shadow-sm ${bulkSelectedDates.length===0 || !bulkMeal ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={() => { if (bulkMeal) applyBulkTiffin(bulkMeal, 'clear'); }}
                  > Clear</button>
                  {bulkSelectedDates.length>0 && (
                    <button
                      className="px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 shadow-sm"
                      onClick={() => { setBulkSelectedDates([]); setBulkAnchorDate(null); }}
                    >Clear selection</button>
                  )}
                </div>
                <button
                  className="px-4 py-1.5 rounded-full border bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 shadow-sm"
                  onClick={() => { commitBulkDraft(); setBulkTiffinMode(false); setBulkSelectedDates([]); setBulkAnchorDate(null); setBulkDraft({ lunch: {}, dinner: {} }); }}
                >Done</button>
              </div>
            </div>
          )}
        </div>
        <div className="mb-6">
          <Calendar
            year={year}
            month={month}
            tiffinByDate={(() => {
              const base = Object.fromEntries(Object.entries(tiffinMap).map(([k, v]) => [k, { lunch: v.lunch?.status, dinner: v.dinner?.status }]));
              if (bulkTiffinMode) {
                const applyDraft = (meal: 'lunch'|'dinner', map: Record<string, 'received'|'skipped'|'clear'>) => {
                  Object.entries(map).forEach(([k, st]) => {
                    const cur = base[k] || {} as any;
                    if (st === 'clear') {
                      cur[meal] = undefined;
                    } else {
                      cur[meal] = st as any;
                    }
                    base[k] = cur;
                  });
                };
                applyDraft('lunch', bulkDraft.lunch);
                applyDraft('dinner', bulkDraft.dinner);
              }
              return base as Record<string, { lunch?: 'received'|'skipped'; dinner?: 'received'|'skipped' }>;
            })()}
            onSelect={(d, modifiers) => {
              const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              if (dMid.getTime() > todayMid.getTime()) { setToastMsg('Cannot edit future dates'); return; }
              if (!bulkTiffinMode) { openDaily(d); return; }

              const ctrlLike = !!modifiers?.ctrlKey || !!modifiers?.metaKey;
              const shift = !!modifiers?.shiftKey;

              const keyOf = (x: Date) => dateKey(x);

              const clampToToday = (x: Date) => {
                const xm = new Date(x.getFullYear(), x.getMonth(), x.getDate());
                return xm.getTime() <= todayMid.getTime();
              };

              const rangeBetween = (a: Date, b: Date) => {
                const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
                const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
                const dir = start.getTime() <= end.getTime() ? 1 : -1;
                const first = dir === 1 ? start : end;
                const last = dir === 1 ? end : start;
                const out: Date[] = [];
                let cur = new Date(first);
                while (cur.getTime() <= last.getTime()) {
                  if (clampToToday(cur)) out.push(new Date(cur));
                  cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
                }
                return out;
              };

              if (shift && bulkAnchorDate) {
                // Select continuous range from anchor to current
                const rng = rangeBetween(bulkAnchorDate, d);
                setBulkSelectedDates(rng);
                // Keep anchor as the original unless ctrl is also pressed, then move anchor
                if (ctrlLike) setBulkAnchorDate(d);
                return;
              }

              if (ctrlLike) {
                // Toggle single date
                setBulkSelectedDates(prev => {
                  const k = keyOf(d);
                  const has = prev.some(x => keyOf(x) === k);
                  return has ? prev.filter(x => keyOf(x) !== k) : [...prev, d];
                });
                setBulkAnchorDate(d);
                return;
              }

              // Plain click: set single selection and anchor
              setBulkSelectedDates([d]);
              setBulkAnchorDate(d);
            }}
            selected={bulkTiffinMode ? null : selectedDate}
            selectedDates={bulkTiffinMode ? bulkSelectedDates : undefined}
            weekStart={weekStart}
            onPrevMonth={() => {
              const d = new Date(viewYear, viewMonth - 1, 1);
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth());
            }}
            onNextMonth={() => {
              const d = new Date(viewYear, viewMonth + 1, 1);
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth());
            }}
            onToday={() => {
              setViewYear(today.getFullYear());
              setViewMonth(today.getMonth());
            }}
            today={today}
          />
        </div>
      </div>

      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? selectedDate.toDateString() : ''}
        actions={<div />}
      >
        {selectedDate && (
          <FadeIn key={dateKey(selectedDate)}>
            {/* Lunch controls */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Lunch</span>
                {(() => {
                  const k = dateKey(selectedDate);
                  const s = tiffinMap[k]?.lunch;
                  return (
                    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      {s?.status && <span className={`w-2.5 h-2.5 rounded-full ${s.status==='received'?'bg-emerald-500':'bg-rose-500'}`}/>} 
                      <span>{s?.status ? (s.status==='received'?'Received':'Skipped') : 'Not set'}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="flex rounded-full overflow-hidden border dark:border-gray-700 shadow-sm">
                {(() => {
                  const k = dateKey(selectedDate);
                  const status = tiffinMap[k]?.lunch?.status;
                  return (
                    <>
                      <button className={`px-3 py-1.5 text-sm ${status==='received' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'} border-r dark:border-gray-700`} onClick={() => setTiffinFor(k, 'lunch', 'received')}> Received</button>
                      <button className={`px-3 py-1.5 text-sm ${status==='skipped' ? 'bg-rose-600 text-white' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'} border-r dark:border-gray-700`} onClick={() => setTiffinFor(k, 'lunch', 'skipped')}> Skipped</button>
                      <button className={`px-3 py-1.5 text-sm ${!status ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'}`} onClick={() => setTiffinFor(k, 'lunch', 'clear')}> Clear</button>
                    </>
                  );
                })()}
              </div>
            </div>
            {(() => {
              const k = dateKey(selectedDate);
              const entry = tiffinMap[k]?.lunch || {};
              if (entry.status === 'skipped') {
                return (
                  <div className="mb-4">
                    <label className="text-sm">Lunch skip reason</label>
                    <input
                      className="mt-1 w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                      placeholder="Why skipped lunch?"
                      value={entry.reason || ''}
                      onChange={(e) => setTiffinReason(k, 'lunch', e.target.value)}
                    />
                  </div>
                );
              }
              return null;
            })()}
            {/* Dinner controls */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Dinner</span>
                {(() => {
                  const k = dateKey(selectedDate);
                  const s = tiffinMap[k]?.dinner;
                  return (
                    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      {s?.status && <span className={`w-2.5 h-2.5 rounded-full ${s.status==='received'?'bg-emerald-500':'bg-rose-500'}`}/>} 
                      <span>{s?.status ? (s.status==='received'?'Received':'Skipped') : 'Not set'}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="flex rounded-full overflow-hidden border dark:border-gray-700 shadow-sm">
                {(() => {
                  const k = dateKey(selectedDate);
                  const status = tiffinMap[k]?.dinner?.status;
                  return (
                    <>
                      <button className={`px-3 py-1.5 text-sm ${status==='received' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'} border-r dark:border-gray-700`} onClick={() => setTiffinFor(k, 'dinner', 'received')}> Received</button>
                      <button className={`px-3 py-1.5 text-sm ${status==='skipped' ? 'bg-rose-600 text-white' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'} border-r dark:border-gray-700`} onClick={() => setTiffinFor(k, 'dinner', 'skipped')}> Skipped</button>
                      <button className={`px-3 py-1.5 text-sm ${!status ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'}`} onClick={() => setTiffinFor(k, 'dinner', 'clear')}> Clear</button>
                    </>
                  );
                })()}
              </div>
            </div>
            {(() => {
              const k = dateKey(selectedDate);
              const entry = tiffinMap[k]?.dinner || {};
              if (entry.status === 'skipped') {
                return (
                  <div className="mb-4">
                    <label className="text-sm">Dinner skip reason</label>
                    <input
                      className="mt-1 w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                      placeholder="Why skipped dinner?"
                      value={entry.reason || ''}
                      onChange={(e) => setTiffinReason(k, 'dinner', e.target.value)}
                    />
                  </div>
                );
              }
              return null;
            })()}
          </FadeIn>
        )}
      </Modal>

      <Toast open={!!toastMsg} message={toastMsg || ''} onClose={() => setToastMsg(null)} />

      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
        actions={
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded border" onClick={() => setShowSettings(false)}>Close</button>
            <button
              className="px-3 py-1.5 rounded bg-blue-600 text-white"
              onClick={() => {
                localStorage.setItem(PROFILE_KEY, JSON.stringify({ displayName, theme, weekStart, tiffinReminderEnabled, tiffinReminderTime }));
                setToastMsg('Settings saved ');
                setShowSettings(false);
              }}
            >Save</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-sm">Display Name</label>
            <input
              className="mt-1 w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
              placeholder="Your name (e.g., Nikhil)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">Theme</label>
            <div className="mt-1 flex gap-2">
              <button className={`px-3 py-1.5 rounded border dark:border-gray-700 ${theme==='light'?'bg-gray-100 dark:bg-gray-700':''}`} onClick={() => { console.log('[theme:click] set light'); setTheme('light'); }}>Light</button>
              <button className={`px-3 py-1.5 rounded border dark:border-gray-700 ${theme==='dark'?'bg-gray-100 dark:bg-gray-700':''}`} onClick={() => { console.log('[theme:click] set dark'); setTheme('dark'); }}>Dark</button>
            </div>
          </div>
          <div>
            <label className="text-sm">Week Start</label>
            <div className="mt-1 flex gap-2">
              <button className={`px-3 py-1.5 rounded border dark:border-gray-700 ${weekStart==='mon'?'bg-gray-100 dark:bg-gray-700':''}`} onClick={() => setWeekStart('mon')}>Mon</button>
              <button className={`px-3 py-1.5 rounded border dark:border-gray-700 ${weekStart==='sun'?'bg-gray-100 dark:bg-gray-700':''}`} onClick={() => setWeekStart('sun')}>Sun</button>
            </div>
          </div>
          <div>
            <label className="text-sm">Meal Reminder</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tiffinReminderEnabled} onChange={(e) => setTiffinReminderEnabled(e.target.checked)} /> Enable</label>
              <input type="time" className="border rounded px-2 py-1 dark:border-gray-700 dark:bg-gray-800" value={tiffinReminderTime} onChange={(e) => setTiffinReminderTime(e.target.value)} />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Shows an in-app reminder if today’s lunch/dinner status isn’t set at the chosen time.</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

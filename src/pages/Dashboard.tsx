import { useEffect, useMemo, useState } from 'react';
import { FiSun, FiMoon, FiSettings } from 'react-icons/fi';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../auth/AuthContext';
import Calendar, { dateKey } from '../components/Calendar';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import FadeIn from '../components/FadeIn';
import { getUserSettings, updateUserSettings } from '../settings/userSettingsService';
import { getMeals, patchMeal, patchMealsBulk } from '../meals/mealsService';

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
  const { user, logout, updateProfile, changePin, deleteAccount } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [showSettings, setShowSettings] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [baseDisplayName, setBaseDisplayName] = useState<string>('');
  const { theme, setTheme, toggleTheme } = useTheme();
  const [pendingTheme, setPendingTheme] = useState<'light'|'dark'>(theme);
  const [baseTheme, setBaseTheme] = useState<'light'|'dark'>(theme);
  const [weekStart, setWeekStart] = useState<'mon' | 'sun'>('mon');
  const [baseWeekStart, setBaseWeekStart] = useState<'mon'|'sun'>('mon');
  const [tiffinMap, setTiffinMap] = useState<Record<string, TiffinDay>>({});
  const [tiffinReminderEnabled, setTiffinReminderEnabled] = useState(false);
  const [baseRemEnabled, setBaseRemEnabled] = useState<boolean>(false);
  const [tiffinReminderTime, setTiffinReminderTime] = useState<string>('12:30');
  const [baseRemTime, setBaseRemTime] = useState<string>('12:30');
  const [bulkTiffinMode, setBulkTiffinMode] = useState(false);
  const [bulkMeal, setBulkMeal] = useState<'lunch' | 'dinner' | null>(null);
  const [bulkSelectedDates, setBulkSelectedDates] = useState<Date[]>([]);
  const [bulkAnchorDate, setBulkAnchorDate] = useState<Date | null>(null);
  const [bulkDraft, setBulkDraft] = useState<{ lunch: Record<string, 'received'|'skipped'|'clear'>; dinner: Record<string, 'received'|'skipped'|'clear'> }>({ lunch: {}, dinner: {} });
  // Account management state
  const [accFullName, setAccFullName] = useState<string>('');
  const [accEmail, setAccEmail] = useState<string>('');
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [deletingAcc, setDeletingAcc] = useState(false);
  const [nowTick, setNowTick] = useState<Date>(new Date());

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
    // restore profile (legacy local cache, will be overridden by server if available)
    try {
      const p = localStorage.getItem(PROFILE_KEY);
      if (p) {
        const parsed = JSON.parse(p) as { displayName?: string; theme?: 'light'|'dark'; weekStart?: 'mon'|'sun'; tiffinReminderEnabled?: boolean; tiffinReminderTime?: string };
        if (parsed.displayName) setDisplayName(parsed.displayName);
        if (parsed.theme === 'dark' || parsed.theme === 'light') setTheme(parsed.theme);
        if (parsed.weekStart === 'mon' || parsed.weekStart === 'sun') setWeekStart(parsed.weekStart);
        if (typeof parsed.tiffinReminderEnabled === 'boolean') setTiffinReminderEnabled(parsed.tiffinReminderEnabled);
        if (typeof parsed.tiffinReminderTime === 'string') setTiffinReminderTime(parsed.tiffinReminderTime);
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

  // Load server user settings when authenticated
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getUserSettings();
        if (cancelled) return;
        setDisplayName(s.display_name || '');
        const themeVal = s.theme === 'dark' ? 'dark' : 'light';
        setTheme(themeVal);
        setWeekStart(s.week_start === 'Sun' ? 'sun' : 'mon');
        const hasTime = !!(s.meal_reminder_time && s.meal_reminder_time.trim());
        setTiffinReminderEnabled(hasTime && s.meal_reminder_enabled);
        setTiffinReminderTime(s.meal_reminder_time && s.meal_reminder_time.trim() ? s.meal_reminder_time : '12:30');
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [setTheme]);

  useEffect(() => {
    localStorage.setItem('mydaylog_view_month', JSON.stringify({ y: viewYear, m: viewMonth }));
  }, [viewYear, viewMonth]);

  useEffect(() => {
    // persist tiffin map
    localStorage.setItem(TIFFIN_KEY, JSON.stringify(tiffinMap));
  }, [tiffinMap]);

  // Load meals for the current view month from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const y = viewYear;
        const m = String(viewMonth + 1).padStart(2, '0');
        const from = `${y}-${m}-01`;
        const lastDay = String(new Date(viewYear, viewMonth + 1, 0).getDate()).padStart(2, '0');
        const to = `${y}-${m}-${lastDay}`;
        const data = await getMeals(from, to);
        if (cancelled) return;
        setTiffinMap(prev => {
          const next: Record<string, TiffinDay> = { ...prev };
          Object.entries(data).forEach(([k, v]) => {
            const day: TiffinDay = { ...(next[k] || {}) };
            if (v.lunch?.status) day.lunch = { status: v.lunch.status, reason: v.lunch.reason };
            else if (day.lunch) delete (day as any).lunch;
            if (v.dinner?.status) day.dinner = { status: v.dinner.status, reason: v.dinner.reason };
            else if (day.dinner) delete (day as any).dinner;
            if (day.lunch || day.dinner) next[k] = day; else delete next[k];
          });
          return next;
        });
      } catch (e: any) {
        // ignore load errors silently to keep UI usable
      }
    })();
    return () => { cancelled = true; };
  }, [viewYear, viewMonth]);

  // timer tick to evaluate time-based UI (panel visibility)
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

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

  // Initialize account form fields from backend user
  useEffect(() => {
    setAccFullName(user?.fullName || '');
    setAccEmail(user?.email || '');
  }, [user]);

  const year = viewYear;
  const month = viewMonth;
  const appName = 'MyDayLog';
  const friendlyName = (displayName && displayName.trim()) ? displayName.trim() : (user?.email?.split('@')[0] || 'there');
  const greeting = useMemo(() => {
    const h = nowTick.getHours();
    const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
    return `${g}, ${friendlyName}`;
  }, [friendlyName, nowTick]);

  const canSaveAccount = useMemo(() => {
    const curName = user?.fullName || '';
    const curEmail = user?.email || '';
    return (accFullName !== curName || accEmail !== curEmail) && !savingAccount;
  }, [accFullName, accEmail, user, savingAccount]);

  const isFour = (s: string) => /^\d{4}$/.test(s);
  const canUpdatePin = useMemo(() => {
    return isFour(pinCurrent) && isFour(pinNew) && isFour(pinConfirm) && pinNew === pinConfirm && !changingPin;
  }, [pinCurrent, pinNew, pinConfirm, changingPin]);

  const canSaveSettings = useMemo(() => {
    const effTime = tiffinReminderEnabled ? (tiffinReminderTime || '') : '';
    const baseEffTime = baseRemEnabled ? (baseRemTime || '') : '';
    return (
      displayName !== baseDisplayName ||
      pendingTheme !== baseTheme ||
      weekStart !== baseWeekStart ||
      effTime !== baseEffTime
    );
  }, [displayName, pendingTheme, weekStart, tiffinReminderEnabled, tiffinReminderTime, baseDisplayName, baseTheme, baseWeekStart, baseRemEnabled, baseRemTime]);

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
    // sync to backend (optimistic)
    void (async () => {
      try {
        const payload: any = { date: k };
        if (meal === 'lunch') payload.lunch_status = status === 'clear' ? '' : status;
        else payload.dinner_status = status === 'clear' ? '' : status;
        await patchMeal(payload);
      } catch (e: any) {
        setToastMsg(e?.message || 'Failed to sync meal ');
      }
    })();
  };

  const setTiffinReason = (k: string, meal: 'lunch' | 'dinner', reason: string) => {
    setTiffinMap(prev => {
      const day = { ...(prev[k] || {}) } as TiffinDay;
      day[meal] = { ...(day[meal] || {}), reason };
      return { ...prev, [k]: day };
    });
    // sync reason to backend (optimistic)
    void (async () => {
      try {
        const payload: any = { date: k };
        if (meal === 'lunch') payload.lunch_reason = reason; else payload.dinner_reason = reason;
        await patchMeal(payload);
      } catch (e: any) {
        setToastMsg(e?.message || 'Failed to sync reason ');
      }
    })();
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
    const items: Array<{ date: string; lunch_status?: ''|'received'|'skipped'; dinner_status?: ''|'received'|'skipped'; }> = [];
    const pushMeal = (meal: 'lunch'|'dinner', map: Record<string, 'received'|'skipped'|'clear'>) => {
      Object.entries(map).forEach(([k, st]) => {
        const existing = items.find(i => i.date === k) || (() => { const it = { date: k } as any; items.push(it); return it; })();
        const val = st === 'clear' ? '' : st;
        if (meal === 'lunch') (existing as any).lunch_status = val; else (existing as any).dinner_status = val;
      });
    };
    pushMeal('lunch', bulkDraft.lunch);
    pushMeal('dinner', bulkDraft.dinner);
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
    // sync bulk to backend (optimistic)
    void (async () => {
      try {
        if (items.length > 0) await patchMealsBulk(items);
      } catch (e: any) {
        setToastMsg(e?.message || 'Failed to sync bulk meals ');
      }
    })();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{appName}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">{greeting} 👋</div>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm text-gray-600 dark:text-gray-300" onClick={logout}>Logout</button>
            <button
              className="relative inline-flex h-6 w-12 items-center rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                toggleTheme();
                void (async () => {
                  try {
                    await updateUserSettings({ theme: next });
                    localStorage.setItem(PROFILE_KEY, JSON.stringify({ displayName, theme: next, weekStart, tiffinReminderEnabled, tiffinReminderTime }));
                  } catch (e: any) {
                    setToastMsg(e?.message || 'Failed to update theme ');
                    setTheme(theme);
                  }
                })();
              }}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            >
              <span className="absolute left-1 text-yellow-500">
                <FiSun className="w-4 h-4" />
              </span>
              <span className="absolute right-1 text-gray-400 dark:text-gray-200">
                <FiMoon className="w-4 h-4" />
              </span>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-300 transition ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}/>
            </button>
            <button
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              onClick={() => { setPendingTheme(theme); setShowSettings(true); setBaseDisplayName(displayName); setBaseTheme(theme); setBaseWeekStart(weekStart); setBaseRemEnabled(tiffinReminderEnabled); setBaseRemTime(tiffinReminderTime); }}
              aria-label="Open settings"
              title="Settings"
            >
              <FiSettings className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {(() => {
          if (!tiffinReminderEnabled || !tiffinReminderTime) return null;
          const [hh, mm] = tiffinReminderTime.split(':').map(n => parseInt(n || '0', 10));
          const threshold = new Date(nowTick.getFullYear(), nowTick.getMonth(), nowTick.getDate(), isNaN(hh)?0:hh, isNaN(mm)?0:mm, 0, 0);
          if (nowTick.getTime() < threshold.getTime()) return null;
          const k = dateKey(nowTick);
          const entry = tiffinMap[k];
          const lunchSet = !!entry?.lunch?.status;
          const dinnerSet = !!entry?.dinner?.status;
          if (lunchSet && dinnerSet) return null;
          let msg = "Today's meals are not yet set";
          if (lunchSet && !dinnerSet) msg = 'Dinner status is not set yet';
          if (!lunchSet && dinnerSet) msg = 'Lunch status is not set yet';
          return (
            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
              <div className="text-sm font-medium text-amber-800 dark:text-amber-200">Meal Reminder</div>
              <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">{msg}</div>
            </div>
          );
        })()}
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
              className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-60"
              disabled={!canSaveSettings}
              onClick={() => {
                // Persist to backend; backend auto-enables by time presence
                void (async () => {
                  try {
                    await updateUserSettings({
                      display_name: displayName,
                      theme: pendingTheme,
                      week_start: weekStart === 'sun' ? 'Sun' : 'Mon',
                      meal_reminder_time: tiffinReminderEnabled ? (tiffinReminderTime || '') : '',
                    });
                    setTheme(pendingTheme);
                    // cache locally for UX
                    localStorage.setItem(PROFILE_KEY, JSON.stringify({ displayName, theme: pendingTheme, weekStart, tiffinReminderEnabled, tiffinReminderTime }));
                    setToastMsg('Settings saved ');
                    setShowSettings(false);
                  } catch (e: any) {
                    setToastMsg(e?.message || 'Failed to save settings ');
                  }
                })();
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
              <button
                className={`px-3 py-1.5 rounded border dark:border-gray-700 ${pendingTheme==='light'?'bg-gray-100 dark:bg-gray-700':''}`}
                onClick={() => setPendingTheme('light')}
              >Light</button>
              <button
                className={`px-3 py-1.5 rounded border dark:border-gray-700 ${pendingTheme==='dark'?'bg-gray-100 dark:bg-gray-700':''}`}
                onClick={() => setPendingTheme('dark')}
              >Dark</button>
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
          <hr className="my-3 border-gray-200 dark:border-gray-700" />
          <div>
            <div className="text-sm font-medium mb-2">Account</div>
            <div className="grid gap-3">
              <div>
                <label className="text-sm">Full Name</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  value={accFullName}
                  onChange={(e) => setAccFullName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-sm">Email</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  value={accEmail}
                  onChange={(e) => setAccEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-60"
                  disabled={!canSaveAccount}
                  onClick={async () => {
                    try {
                      setSavingAccount(true);
                      await updateProfile({ fullName: accFullName || undefined, email: accEmail || undefined });
                      setToastMsg('Account updated ');
                    } catch (e: any) {
                      setToastMsg(e?.message || 'Failed to update account');
                    } finally {
                      setSavingAccount(false);
                    }
                  }}
                >{savingAccount ? 'Saving...' : 'Save Account'}</button>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Change PIN</div>
            <div className="grid gap-2 md:grid-cols-3">
              <input className="border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800" placeholder="Current PIN" inputMode="numeric" maxLength={4} value={pinCurrent} onChange={e => setPinCurrent(e.target.value.replace(/\D/g,'').slice(0,4))} type="password" />
              <input className="border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800" placeholder="New PIN" inputMode="numeric" maxLength={4} value={pinNew} onChange={e => setPinNew(e.target.value.replace(/\D/g,'').slice(0,4))} type="password" />
              <input className="border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800" placeholder="Confirm PIN" inputMode="numeric" maxLength={4} value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g,'').slice(0,4))} type="password" />
            </div>
            <div className="mt-2">
              <button
                className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={!canUpdatePin}
                onClick={async () => {
                  if (pinNew !== pinConfirm) { setToastMsg('PINs do not match'); return; }
                  if (!/^\d{4}$/.test(pinCurrent) || !/^\d{4}$/.test(pinNew)) { setToastMsg('PIN must be 4 digits'); return; }
                  try {
                    setChangingPin(true);
                    await changePin(pinCurrent, pinNew);
                    setPinCurrent(''); setPinNew(''); setPinConfirm('');
                    setToastMsg('PIN updated ');
                  } catch (e: any) {
                    setToastMsg(e?.message || 'Failed to update PIN');
                  } finally {
                    setChangingPin(false);
                  }
                }}
              >{changingPin ? 'Updating...' : 'Update PIN'}</button>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2 text-rose-600">Danger Zone</div>
            <button
              className="px-3 py-1.5 rounded border border-rose-600 text-rose-700 hover:bg-rose-50 dark:border-rose-500 dark:text-rose-300 disabled:opacity-60"
              disabled={deletingAcc}
              onClick={async () => {
                if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
                try {
                  setDeletingAcc(true);
                  await deleteAccount();
                  setToastMsg('Account deleted ');
                } catch (e: any) {
                  setToastMsg(e?.message || 'Failed to delete account');
                } finally {
                  setDeletingAcc(false);
                }
              }}
            >{deletingAcc ? 'Deleting...' : 'Delete Account'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

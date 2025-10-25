import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../auth/AuthContext';
import Calendar, { dateKey, type DayStatus } from '../components/Calendar';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import DailyTasks from '../components/DailyTasks';
import FadeIn from '../components/FadeIn';

type Task = {
  id: string;
  title: string;
  done: boolean;
  notes?: string;
};

type Store = Record<string, Task[]>;

const STORAGE_KEY = 'mydaylog_tasks';
const PROFILE_KEY = 'mydaylog_profile';
const TIFFIN_KEY = 'mydaylog_tiffin';

type TiffinEntry = {
  status?: 'received' | 'skipped';
  reason?: string; // for skipped
  meal?: 'veg' | 'nonveg'; // for received
  cost?: number; // for received
};

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(s: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function randomId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [store, setStore] = useState<Store>({});
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ k: string; id: string; draft: string } | null>(null);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [showSettings, setShowSettings] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const { theme, setTheme, toggleTheme } = useTheme();
  const [weekStart, setWeekStart] = useState<'mon' | 'sun'>('mon');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [tiffinMap, setTiffinMap] = useState<Record<string, TiffinEntry>>({});
  const [tiffinReminderEnabled, setTiffinReminderEnabled] = useState(false);
  const [tiffinReminderTime, setTiffinReminderTime] = useState<string>('12:30');
  const [bulkTiffinMode, setBulkTiffinMode] = useState(false);
  const [bulkSelectedDates, setBulkSelectedDates] = useState<Date[]>([]);

  useEffect(() => {
    setStore(loadStore());
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
    // restore tiffin map (backward compatible with string values)
    try {
      const t = localStorage.getItem(TIFFIN_KEY);
      if (t) {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object') {
          const fixed: Record<string, TiffinEntry> = {};
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'string') fixed[k] = { status: v as any };
            else fixed[k] = v as TiffinEntry;
          });
          setTiffinMap(fixed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    saveStore(store);
  }, [store]);

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
      if (!tiffinMap[todayKey] || !tiffinMap[todayKey].status) {
        if (last !== todayKey) {
          setToastMsg("Don't forget to set today's Tiffin status 🍽️");
          localStorage.setItem(REM_KEY, todayKey);
        }
      }
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [tiffinReminderEnabled, tiffinReminderTime, tiffinMap]);

  useEffect(() => {
    // Clear selection when date changes
    setSelectedIds([]);
    setSelectMode(false);
  }, [selectedDate]);

  const year = viewYear;
  const month = viewMonth;
  const monthKeyPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;

  const statusByDate: Record<string, DayStatus> = useMemo(() => {
    const res: Record<string, DayStatus> = {};
    Object.entries(store).forEach(([k, tasks]) => {
      if (!k.startsWith(monthKeyPrefix)) return;
      if (!tasks.length) return;
      const done = tasks.filter(t => t.done).length;
      const status: DayStatus = done === 0 ? 'red' : done === tasks.length ? 'green' : 'yellow';
      res[k] = status;
    });
    return res;
  }, [store, monthKeyPrefix]);

  // Tiffin stats
  const monthTiffin = useMemo(() => {
    const total = new Date(year, month + 1, 0).getDate();
    let received = 0; let skipped = 0;
    for (let d = 1; d <= total; d++) {
      const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = tiffinMap[k];
      if (entry?.status === 'received') received += 1;
      else if (entry?.status === 'skipped') skipped += 1;
    }
    const unset = Math.max(0, total - (received + skipped));
    const pct = total ? Math.round((received / total) * 100) : 0;
    return { received, skipped, unset, total, pct };
  }, [tiffinMap, year, month]);

  const weekTiffin = useMemo(() => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const offset = weekStart === 'mon' ? (day === 0 ? 6 : day - 1) : day;
    const start = new Date(today);
    start.setDate(today.getDate() - offset);
    const total = 7;
    let received = 0; let skipped = 0;
    for (let i = 0; i < total; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = dateKey(d);
      const entry = tiffinMap[k];
      if (entry?.status === 'received') received += 1;
      else if (entry?.status === 'skipped') skipped += 1;
    }
    const unset = Math.max(0, total - (received + skipped));
    const pct = total ? Math.round((received / total) * 100) : 0;
    return { received, skipped, unset, total, pct };
  }, [tiffinMap, weekStart]);

  const tiffinStreak = useMemo(() => {
    let streak = 0;
    let d = new Date();
    while (true) {
      const k = dateKey(d);
      const entry = tiffinMap[k];
      if (entry?.status === 'received') {
        streak += 1;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [tiffinMap]);

  const countsByDate: Record<string, number> = useMemo(() => {
    const res: Record<string, number> = {};
    Object.entries(store).forEach(([k, tasks]) => {
      if (!k.startsWith(monthKeyPrefix)) return;
      res[k] = tasks.length;
    });
    return res;
  }, [store, monthKeyPrefix]);

  const tasksToday = store[dateKey(today)] || [];
  const tasksDoneToday = tasksToday.filter(t => t.done).length;
  const daysLoggedThisMonth = useMemo(() => Object.keys(store).filter(k => k.startsWith(monthKeyPrefix) && (store[k]?.length || 0) > 0).length, [store, monthKeyPrefix]);
  const monthTotals = useMemo(() => {
    let done = 0; let total = 0; let pending = 0;
    Object.entries(store).forEach(([k, tasks]) => {
      if (!k.startsWith(monthKeyPrefix)) return;
      total += tasks.length;
      done += tasks.filter(t => t.done).length;
      pending += tasks.filter(t => !t.done).length;
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pct, pending };
  }, [store, monthKeyPrefix]);

  const openDaily = (d: Date) => {
    setSelectedDate(d);
  };

  const toggleTask = (k: string, id: string) => {
    setStore(prev => {
      const arr = prev[k] ? [...prev[k]] : [];
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) arr[idx] = { ...arr[idx], done: !arr[idx].done };
      return { ...prev, [k]: arr };
    });
    setToastMsg('Task updated successfully ✅');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setSelectMode(next.length > 0);
      return next;
    });
  };

  const bulkComplete = () => {
    if (!selectedDate) return;
    const k = dateKey(selectedDate);
    setStore(prev => {
      const arr = prev[k] ? [...prev[k]] : [];
      const setSel = new Set(selectedIds);
      const next = arr.map(t => setSel.has(t.id) ? { ...t, done: true } : t);
      return { ...prev, [k]: next };
    });
    setToastMsg('Marked selected as done ✅');
    setSelectedIds([]);
  };

  const bulkRemove = () => {
    if (!selectedDate) return;
    const k = dateKey(selectedDate);
    setStore(prev => {
      const arr = prev[k] ? [...prev[k]] : [];
      const setSel = new Set(selectedIds);
      const next = arr.filter(t => !setSel.has(t.id));
      return { ...prev, [k]: next };
    });
    setToastMsg('Removed selected 🗑️');
    setSelectedIds([]);
  };

  const addTask = (k: string, title: string) => {
    const t: Task = { id: randomId(), title, done: false };
    setStore(prev => ({ ...prev, [k]: [...(prev[k] || []), t] }));
  };

  const removeTask = (k: string, id: string) => {
    setStore(prev => ({ ...prev, [k]: (prev[k] || []).filter(t => t.id !== id) }));
  };

  const openNotes = (k: string, id: string) => {
    const task = (store[k] || []).find(t => t.id === id);
    setEditingNotes({ k, id, draft: task?.notes || '' });
  };

  const saveNotes = () => {
    if (!editingNotes) return;
    const { k, id, draft } = editingNotes;
    setStore(prev => {
      const arr = prev[k] ? [...prev[k]] : [];
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) arr[idx] = { ...arr[idx], notes: draft };
      return { ...prev, [k]: arr };
    });
    setEditingNotes(null);
    setToastMsg('Task updated successfully ✅');
  };

  const renameTask = (k: string, id: string, title: string) => {
    setStore(prev => {
      const arr = prev[k] ? [...prev[k]] : [];
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) arr[idx] = { ...arr[idx], title };
      return { ...prev, [k]: arr };
    });
    setToastMsg('Task updated successfully ✅');
  };

  const reorderTasks = (k: string, fromIndex: number, toIndex: number) => {
    setStore(prev => {
      const arr = prev[k] ? [...prev[k]] : [];
      if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return prev;
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return { ...prev, [k]: arr };
    });
    setToastMsg('Order updated ✅');
  };

  const onQuickAdd = () => {
    setNewTitle('');
    setShowAdd(true);
  };

  const confirmQuickAdd = () => {
    if (!newTitle.trim()) return;
    addTask(dateKey(today), newTitle.trim());
    setShowAdd(false);
  };

  const setTiffinFor = (k: string, status: 'received' | 'skipped' | 'clear') => {
    setTiffinMap(prev => {
      const next: Record<string, TiffinEntry> = { ...prev };
      if (status === 'clear') delete next[k];
      else next[k] = { ...(next[k] || {}), status };
      return next;
    });
    setToastMsg('Tiffin status updated ✅');
  };

  const setTiffinReason = (k: string, reason: string) => {
    setTiffinMap(prev => ({ ...prev, [k]: { ...(prev[k] || {}), reason } }));
  };

  const toggleBulkDate = (d: Date) => {
    setBulkSelectedDates(prev => {
      const key = dateKey(d);
      const has = prev.some(x => dateKey(x) === key);
      return has ? prev.filter(x => dateKey(x) !== key) : [...prev, d];
    });
  };

  const applyBulkTiffin = (status: 'received' | 'skipped' | 'clear') => {
    if (bulkSelectedDates.length === 0) return;
    setTiffinMap(prev => {
      const next: Record<string, TiffinEntry> = { ...prev };
      bulkSelectedDates.forEach(d => {
        const k = dateKey(d);
        if (status === 'clear') delete next[k];
        else next[k] = { ...(next[k] || {}), status };
      });
      return next;
    });
    setToastMsg('Tiffin statuses updated ✅');
  };


  const currentGreetingMonth = new Date(year, month, 1).toLocaleString(undefined, { month: 'long' });
  const fallbackName = user?.guest ? 'there' : (user?.identifier?.split('@')[0] || 'there');
  const greetingName = displayName || fallbackName;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">Hey {greetingName} 👋, here’s your {currentGreetingMonth} progress</div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">Tasks Done Today</div>
            <div className="text-2xl font-semibold">{tasksDoneToday}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">Days Logged This Month</div>
            <div className="text-2xl font-semibold">{daysLoggedThisMonth}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">Overall Completion %</div>
            <div className="text-2xl font-semibold">{monthTotals.pct}%</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">Pending Tasks</div>
            <div className="text-2xl font-semibold">{monthTotals.pending}</div>
          </div>
        </div>

        <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Tiffin Stats</div>
            <div className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Streak: {tiffinStreak} day{tiffinStreak===1?'':'s'}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border rounded-lg p-3 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">This Week</div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700">Received {weekTiffin.received}/7</span>
                <span className="text-sm px-2 py-1 rounded bg-rose-50 text-rose-700">Skipped {weekTiffin.skipped}</span>
                <span className="text-sm px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Unset {weekTiffin.unset}</span>
                <span className="ml-auto text-sm px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Rate {weekTiffin.pct}%</span>
              </div>
            </div>
            <div className="border rounded-lg p-3 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">This Month</div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700">Received {monthTiffin.received}/{new Date(year, month + 1, 0).getDate()}</span>
                <span className="text-sm px-2 py-1 rounded bg-rose-50 text-rose-700">Skipped {monthTiffin.skipped}</span>
                <span className="text-sm px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Unset {monthTiffin.unset}</span>
                <span className="ml-auto text-sm px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Rate {monthTiffin.pct}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!bulkTiffinMode ? (
            <button
              className="px-3 py-1.5 rounded border dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
              onClick={() => { setBulkTiffinMode(true); setBulkSelectedDates([]); }}
            >Bulk set Tiffin</button>
          ) : (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-300">{bulkSelectedDates.length} date{bulkSelectedDates.length===1?'':'s'} selected</span>
              <button className="px-3 py-1.5 rounded border bg-emerald-50 text-emerald-700 dark:border-emerald-300/30" onClick={() => applyBulkTiffin('received')}>Mark Received</button>
              <button className="px-3 py-1.5 rounded border bg-rose-50 text-rose-700 dark:border-rose-300/30" onClick={() => applyBulkTiffin('skipped')}>Mark Skipped</button>
              <button className="px-3 py-1.5 rounded border dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700" onClick={() => applyBulkTiffin('clear')}>Clear</button>
              <button
                className="ml-auto px-3 py-1.5 rounded border dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={() => { setBulkTiffinMode(false); setBulkSelectedDates([]); }}
              >Done</button>
            </>
          )}
        </div>
        <div className="mb-6">
          <Calendar
            year={year}
            month={month}
            statusByDate={statusByDate}
            countsByDate={countsByDate}
            tiffinByDate={Object.fromEntries(Object.entries(tiffinMap).map(([k, v]) => [k, v.status]).filter(([_, s]) => !!s)) as Record<string, 'received'|'skipped'>}
            onSelect={(d) => {
              if (bulkTiffinMode) toggleBulkDate(d); else openDaily(d);
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
            onDropTask={(targetDate, data) => {
              const toKey = dateKey(targetDate);
              const fromKey = data.fromKey;
              const id = data.taskId;
              if (fromKey === toKey) return;
              setStore(prev => {
                const fromArr = prev[fromKey] ? [...prev[fromKey]] : [];
                const idx = fromArr.findIndex(t => t.id === id);
                if (idx < 0) return prev;
                const task = fromArr[idx];
                fromArr.splice(idx, 1);
                const toArr = prev[toKey] ? [...prev[toKey]] : [];
                toArr.push(task);
                return { ...prev, [fromKey]: fromArr, [toKey]: toArr };
              });
              setToastMsg('Task moved ✅');
            }}
          />
        </div>
      </div>

      <button
        onClick={onQuickAdd}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full w-14 h-14 text-3xl leading-[3.5rem] text-center shadow-lg"
        aria-label="Add Task"
      >
        +
      </button>

      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? selectedDate.toDateString() : ''}
        actions={
          <div className="w-full flex items-center justify-between gap-3">
            {selectMode ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
                <button className="px-3 py-1.5 rounded border" disabled={selectedIds.length===0} onClick={bulkComplete}>Complete</button>
                <button className="px-3 py-1.5 rounded border text-red-600" disabled={selectedIds.length===0} onClick={bulkRemove}>Remove</button>
              </div>
            ) : <div />}
            <button
              className="bg-blue-600 text-white px-3 py-1.5 rounded"
              onClick={() => {
                setNewTitle('');
                setShowAdd(true);
              }}
            >Add Task</button>
          </div>
        }
      >
        {selectedDate && (
          <FadeIn key={dateKey(selectedDate)}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Tiffin</span>
                {(() => {
                  const k = dateKey(selectedDate);
                  const s = tiffinMap[k];
                  return (
                    <span className="inline-flex items-center gap-1">
                      {s?.status && <span className={`w-2 h-2 rounded-full ${s.status==='received'?'bg-emerald-500':'bg-rose-500'}`}/>} 
                      <span className="text-gray-500 dark:text-gray-400">{s?.status ? (s.status==='received'?'Received':'Skipped') : 'Not set'}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="flex rounded-md overflow-hidden border dark:border-gray-700">
                {(() => {
                  const k = dateKey(selectedDate);
                  const status = tiffinMap[k]?.status;
                  const btn = (label: string, active: boolean, onClick: () => void) => (
                    <button className={`px-3 py-1.5 text-sm ${active ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'} border-r last:border-r-0 dark:border-gray-700`} onClick={onClick}>{label}</button>
                  );
                  return (
                    <>
                      {btn('Received', status==='received', () => setTiffinFor(k, 'received'))}
                      {btn('Skipped', status==='skipped', () => setTiffinFor(k, 'skipped'))}
                      {btn('Clear', !status, () => setTiffinFor(k, 'clear'))}
                    </>
                  );
                })()}
              </div>
            </div>
            {(() => {
              const k = dateKey(selectedDate);
              const entry = tiffinMap[k] || {};
              if (entry.status === 'skipped') {
                return (
                  <div className="mb-4">
                    <label className="text-sm">Skip reason</label>
                    <input
                      className="mt-1 w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                      placeholder="Why skipped?"
                      value={entry.reason || ''}
                      onChange={(e) => setTiffinReason(k, e.target.value)}
                    />
                  </div>
                );
              }
              return null;
            })()}
            <DailyTasks
              k={dateKey(selectedDate)}
              tasks={store[dateKey(selectedDate)] || []}
              onToggle={toggleTask}
              onRemove={removeTask}
              onEditNotes={openNotes}
              onRename={renameTask}
              onReorder={reorderTasks}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              selectMode={selectMode}
              onSelectAll={(ids: string[], checked: boolean) => {
                setSelectedIds(checked ? ids : []);
              }}
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  className={`px-3 py-1.5 rounded border dark:border-gray-700 ${selectMode ? 'bg-gray-100 dark:bg-gray-700' : 'dark:bg-gray-800'}`}
                  onClick={() => {
                    setSelectMode(v => {
                      const next = !v;
                      if (!next) setSelectedIds([]);
                      return next;
                    });
                  }}
                >Multi-select</button>
                {selectMode && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">Use sticky bar below for bulk actions</div>
                )}
              </div>
            </div>
          </FadeIn>
        )}
      </Modal>

      <Modal
        open={!!editingNotes}
        onClose={() => setEditingNotes(null)}
        title="Notes"
        actions={
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded border" onClick={() => setEditingNotes(null)}>Cancel</button>
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={saveNotes}>Save</button>
          </div>
        }
      >
        <textarea
          className="w-full border rounded p-2 min-h-28 dark:border-gray-700 dark:bg-gray-800"
          placeholder="Add remarks..."
          value={editingNotes?.draft || ''}
          onChange={(e) => setEditingNotes(prev => prev ? { ...prev, draft: e.target.value } : prev)}
        />
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
                setToastMsg('Settings saved ✅');
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
            <label className="text-sm">Tiffin Reminder</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tiffinReminderEnabled} onChange={(e) => setTiffinReminderEnabled(e.target.checked)} /> Enable</label>
              <input type="time" className="border rounded px-2 py-1 dark:border-gray-700 dark:bg-gray-800" value={tiffinReminderTime} onChange={(e) => setTiffinReminderTime(e.target.value)} />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Shows an in-app reminder if today’s tiffin status isn’t set at the chosen time.</div>
          </div>
        </div>
      </Modal>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Task"
        actions={
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded border" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={confirmQuickAdd}>Add</button>
          </div>
        }
      >
        <input
          className="w-full border rounded px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          placeholder="Assignment submission, Tiffin received, ..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
        />
      </Modal>
    </div>
  );
}

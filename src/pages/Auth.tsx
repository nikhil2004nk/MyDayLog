import { type FormEvent, useRef, useState } from 'react';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheckCircle, FiSun, FiMoon } from 'react-icons/fi';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeProvider';

export default function AuthPage() {
  const { login, signup, continueAsGuest } = useAuth();
  const nav = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [fullName, setFullName] = useState('');
  const [pinDigits, setPinDigits] = useState<[string, string, string, string]>(['', '', '', '']);
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'fullName'|'email'|'pin'|'confirmPin', string>>>({});

  const loginSchema = z.object({
    email: z.string().email('Enter a valid email'),
    pin: z.string().regex(/^\d{4}$/,'PIN must be 4 digits'),
  });
  const signupSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Enter a valid email'),
    pin: z.string().regex(/^\d{4}$/,'PIN must be 4 digits'),
    confirmPin: z.string(),
  }).refine((d: { pin: string; confirmPin: string }) => d.pin === d.confirmPin, { path: ['confirmPin'], message: 'PIN and Confirm PIN do not match' });

  const applyZodErrors = (issue: unknown) => {
    if (issue instanceof z.ZodError) {
      const err = issue as z.ZodError;
      const next: Partial<Record<'fullName'|'email'|'pin'|'confirmPin', string>> = {};
      for (const e of err.errors) {
        const path = (e.path?.[0] as string) || '';
        if (path === 'fullName' || path === 'email' || path === 'pin' || path === 'confirmPin') {
          next[path] = e.message;
        }
      }
      setFieldErrors(next);
      return true;
    }
    return false;
  };

  // Live field validators for signup
  const fullNameSchema = z
    .string()
    .trim()
    .min(2, 'Full name is required')
    .max(100, 'Full name is too long')
    .refine((val) => {
      const v = val.trim();
      if (!v) return false;
      // Only allow letters, spaces, apostrophes and hyphens
      if (!/^[A-Za-z][A-Za-z'\- ]*[A-Za-z]$/.test(v)) return false;
      const parts = v.split(/\s+/).filter(Boolean);
      if (parts.length < 2) return false; // at least first and last name
      return parts.every((p) => /^[A-Za-z][A-Za-z'\-]*[A-Za-z]$/.test(p) && p.length >= 2);
    }, { message: 'Enter first and last name (letters only)' });
  const emailSchema = z.string().email('Enter a valid email');
  const pinSchema = z.string().regex(/^\d{4}$/,'PIN must be 4 digits');

  const setFieldError = (k: 'fullName'|'email'|'pin'|'confirmPin', msg?: string) => {
    setFieldErrors(prev => ({ ...prev, [k]: msg }));
  };

  const validateSignupField = (k: 'fullName'|'email'|'pin'|'confirmPin', value: string) => {
    try {
      if (k === 'fullName') fullNameSchema.parse(value);
      if (k === 'email') emailSchema.parse(value);
      if (k === 'pin') pinSchema.parse(value);
      if (k === 'confirmPin') {
        // Only check match here; its own format follows pin rules but we prioritize match message
        if (value !== pin) throw new z.ZodError([{ code: 'custom', message: 'PIN and Confirm PIN do not match', path: ['confirmPin'] } as any]);
      }
      setFieldError(k, undefined);
    } catch (e) {
      if (e instanceof z.ZodError) {
        const msg = e.errors?.[0]?.message || 'Invalid value';
        setFieldError(k, msg);
      }
    }
  };

  // Keep confirm pin validation in sync when pin changes
  const onChangePinSignup = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 4);
    setPin(v);
    setError(null);
    validateSignupField('pin', v);
    // revalidate confirm pin against new pin
    if (confirmPin) validateSignupField('confirmPin', confirmPin);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        setFieldErrors({});
        const composed = pinDigits.join('');
        const parsed = loginSchema.safeParse({ email, pin: composed });
        if (!parsed.success) {
          applyZodErrors(parsed.error);
          throw new Error('Please fix the errors above');
        }
        await login({ email: parsed.data.email, pin: parsed.data.pin });
        nav('/dashboard', { replace: true });
      } else {
        setFieldErrors({});
        const parsed = signupSchema.safeParse({ fullName, email, pin, confirmPin });
        if (!parsed.success) {
          applyZodErrors(parsed.error);
          throw new Error('Please fix the errors above');
        }
        await signup({ email: parsed.data.email, pin: parsed.data.pin, fullName: parsed.data.fullName });
        setMode('login');
        setPin('');
        setConfirmPin('');
        setPinDigits(['', '', '', '']);
        setError('Account created. Please login.');
      }
    } catch (err: any) {
      if (!applyZodErrors(err)) {
        setError(err?.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const onGuest = async () => {
    setError(null);
    setLoading(true);
    try {
      await continueAsGuest();
      nav('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="relative w-full max-w-md md:max-w-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl p-6 md:p-8">
        <button
          type="button"
          className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <FiSun className="w-5 h-5 text-yellow-400"/> : <FiMoon className="w-5 h-5 text-gray-700"/>}
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">MyDayLog</h1>
          <p className="mt-1 text-xs md:text-sm text-gray-600 dark:text-gray-300">Track your daily lunch and dinner quickly. Set statuses in a calendar, view stats, and get gentle reminders.</p>
        </div>
        <div className="mt-5 flex gap-1.5 bg-gray-100 dark:bg-gray-700 p-1 rounded-full">
          <button
            className={`flex-1 py-2 rounded-full text-sm transition ${mode==='login'?'bg-white dark:bg-gray-800 shadow':''}`}
            onClick={() => setMode('login')}
            type="button"
          >Login</button>
          <button
            className={`flex-1 py-2 rounded-full text-sm transition ${mode==='signup'?'bg-white dark:bg-gray-800 shadow':''}`}
            onClick={() => setMode('signup')}
            type="button"
          >Sign up</button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          {mode === 'signup' && (
            <div>
              <label className="text-lg">Full name</label>
              <div className="mt-1 relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500 dark:text-gray-400"><FiUser className="w-4 h-4"/></span>
                <input
                  className="h-12 pl-9 w-full border rounded-lg px-3 outline-none focus:ring-2 ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); validateSignupField('fullName', e.target.value); setError(null); }}
                  onBlur={(e) => { const t = e.target.value.trim(); setFullName(t); validateSignupField('fullName', t); }}
                  placeholder="John Doe"
                  autoComplete="name"
                  required
                />
              </div>
              {fieldErrors.fullName && <div className="text-red-600 text-xs mt-1">{fieldErrors.fullName}</div>}
            </div>
          )}
          <div>
            <label className="text-lg">Email</label>
            <div className="mt-1 relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500 dark:text-gray-400"><FiMail className="w-4 h-4"/></span>
              <input
                className="h-12 pl-9 w-full border rounded-lg px-3 outline-none focus:ring-2 ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (mode==='signup') { validateSignupField('email', e.target.value); setError(null); } }}
                onBlur={(e) => { if (mode==='signup') validateSignupField('email', e.target.value); }}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            {fieldErrors.email && <div className="text-red-600 text-xs mt-1">{fieldErrors.email}</div>}
          </div>
          {mode === 'login' ? (
            <div>
              <label className="text-lg block text-left">PIN</label>
              <div className="mt-2 flex justify-center gap-1 sm:gap-2 flex-nowrap">
                {pinDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    className="shrink-0 h-12 w-12 text-center text-lg border-2 rounded-lg outline-none focus:ring-2 ring-blue-500 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                    value={d}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 1);
                      const next = [...pinDigits] as [string, string, string, string];
                      next[i] = val;
                      setPinDigits(next);
                      if (val && i < 3) pinRefs[i + 1].current?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace') {
                        if (pinDigits[i]) {
                          const next = [...pinDigits] as [string, string, string, string];
                          next[i] = '';
                          setPinDigits(next);
                        } else if (i > 0) {
                          pinRefs[i - 1].current?.focus();
                        }
                      }
                      if (e.key === 'ArrowLeft' && i > 0) pinRefs[i - 1].current?.focus();
                      if (e.key === 'ArrowRight' && i < 3) pinRefs[i + 1].current?.focus();
                    }}
                  />
                ))}
              </div>
              {fieldErrors.pin && <div className="text-red-600 text-xs mt-1">{fieldErrors.pin}</div>}
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm">PIN</label>
                <div className="mt-1 relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500 dark:text-gray-400"><FiLock className="w-5 h-5"/></span>
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    className="h-14 pl-11 w-full border rounded-lg px-4 pr-12 outline-none focus:ring-2 ring-blue-500 dark:border-gray-700 dark:bg-gray-800 text-base"
                    value={pin}
                    onChange={(e) => onChangePinSignup(e.target.value)}
                    onBlur={(e) => validateSignupField('pin', e.target.value)}
                    placeholder="4-digit PIN"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-gray-600 dark:text-gray-300"
                    onClick={() => setShowPin(p => !p)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  >{showPin ? <FiEyeOff className="w-6 h-6"/> : <FiEye className="w-6 h-6"/>}</button>
                </div>
                {fieldErrors.pin && <div className="text-red-600 text-xs mt-1">{fieldErrors.pin}</div>}
              </div>
              <div>
                <label className="text-sm">Confirm PIN</label>
                <div className="mt-1 relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500 dark:text-gray-400"><FiCheckCircle className="w-5 h-5"/></span>
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    className="h-14 pl-11 w-full border rounded-lg px-4 outline-none focus:ring-2 ring-blue-500 dark:border-gray-700 dark:bg-gray-800 text-base"
                    value={confirmPin}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setConfirmPin(v); validateSignupField('confirmPin', v); setError(null); }}
                    onBlur={(e) => validateSignupField('confirmPin', e.target.value)}
                    placeholder="Re-enter PIN"
                    autoComplete="new-password"
                    required
                  />
                </div>
                {fieldErrors.confirmPin && <div className="text-red-600 text-xs mt-1">{fieldErrors.confirmPin}</div>}
              </div>
            </>
          )}

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 disabled:opacity-50 shadow"
          >{loading ? 'Please wait...' : (mode==='login' ? 'Login' : 'Create account')}</button>
        </form>

        <div className="mt-4">
          <button
            onClick={onGuest}
            disabled={loading}
            className="w-full border rounded-lg py-2 disabled:opacity-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >Continue as Guest</button>
        </div>
      </div>
    </div>
  );
}

import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AuthPage() {
  const { login, signup, continueAsGuest } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ identifier, password });
      } else {
        await signup({ identifier, password });
      }
      nav('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h1 className="text-xl font-semibold text-center">MyDayLog</h1>
        <div className="mt-4 flex gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded">
          <button
            className={`flex-1 py-2 rounded text-sm ${mode==='login'?'bg-white dark:bg-gray-800 shadow':''}`}
            onClick={() => setMode('login')}
          >Login</button>
          <button
            className={`flex-1 py-2 rounded text-sm ${mode==='signup'?'bg-white dark:bg-gray-800 shadow':''}`}
            onClick={() => setMode('signup')}
          >Sign up</button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm">Email or Phone</label>
            <input
              className="mt-1 w-full border rounded px-3 py-2 outline-none focus:ring-2 ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or 9876543210"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-sm">Password</label>
            <input
              type="password"
              className="mt-1 w-full border rounded px-3 py-2 outline-none focus:ring-2 ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50"
          >{loading ? 'Please wait...' : (mode==='login' ? 'Login' : 'Create account')}</button>
        </form>

        <div className="mt-4">
          <button
            onClick={onGuest}
            disabled={loading}
            className="w-full border rounded py-2 disabled:opacity-50 dark:border-gray-700"
          >Continue as Guest</button>
        </div>
      </div>
    </div>
  );
}

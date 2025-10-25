import { API_BASE } from '../environment';
import { refreshSession } from '../auth/authService';

export type UserSettings = {
  user_id: string;
  display_name: string;
  theme: 'light' | 'dark';
  week_start: 'Mon' | 'Sun';
  meal_reminder_enabled: boolean;
  meal_reminder_time: string;
  created_at: string;
  updated_at: string;
};

 

async function rawFetch(path: string, init: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function request<T>(path: string, init: RequestInit, _triedRefresh = false): Promise<T> {
  const res = await rawFetch(path, init);
  if (res.status === 401 && !_triedRefresh) {
    try {
      await refreshSession();
      const retry = await rawFetch(path, init);
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      if (!retry.ok) {
        const msg = (retryData as any)?.message || 'Request failed';
        throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
      }
      return retryData as T;
    } catch (e) {
      // fall-through
    }
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || 'Request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return data as T;
}

export async function getUserSettings(): Promise<UserSettings> {
  return request<UserSettings>('/user-settings', { method: 'GET' });
}

export async function updateUserSettings(updates: Partial<Pick<UserSettings, 'display_name' | 'theme' | 'week_start' | 'meal_reminder_enabled' | 'meal_reminder_time'>>): Promise<UserSettings> {
  return request<UserSettings>('/user-settings', { method: 'PATCH', body: JSON.stringify(updates) });
}

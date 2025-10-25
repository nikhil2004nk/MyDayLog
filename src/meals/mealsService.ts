import { API_BASE } from '../environment';
import { refreshSession } from '../auth/authService';

export type MealStatus = 'received' | 'skipped';

export type MealsResponse = Record<string, {
  lunch?: { status: MealStatus; reason?: string };
  dinner?: { status: MealStatus; reason?: string };
}>;

 

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
    } catch {
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

export async function getMeals(from: string, to: string): Promise<MealsResponse> {
  const qs = new URLSearchParams({ from, to }).toString();
  return request<MealsResponse>(`/meals?${qs}`, { method: 'GET' });
}

export type PatchMealPayload = {
  date: string;
  lunch_status?: '' | MealStatus;
  lunch_reason?: string;
  dinner_status?: '' | MealStatus;
  dinner_reason?: string;
};

export async function patchMeal(payload: PatchMealPayload): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/meals`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function patchMealsBulk(items: PatchMealPayload[]): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/meals/bulk`, { method: 'PATCH', body: JSON.stringify({ items }) });
}

import { API_BASE } from '../environment';

export type Credentials = {
  email: string;
  pin: string;
  fullName?: string;
};

export type User = {
  id: string;
  email: string;
  fullName?: string;
  guest?: boolean;
};

export type AuthResponse = {
  token: string;
  user: User;
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
      // fall-through to original error parsing below
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

export async function login(creds: Credentials): Promise<AuthResponse> {
  if (!creds.email || !creds.pin) throw new Error('Please provide email and PIN');
  const data = await request<{ id: string; email: string }>(`/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: creds.email, pin: creds.pin }),
  });
  const user: User = { id: data.id, email: data.email };
  // Backend sets httpOnly cookies. We synthesize a non-sensitive token flag for UI routing.
  return { token: 'cookie', user };
}

export async function signup(creds: Credentials): Promise<AuthResponse> {
  if (!creds.email || !creds.pin || !creds.fullName) throw new Error('Please provide full name, email and PIN');
  const data = await request<{ id: string; email: string; fullName?: string }>(`/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email: creds.email, pin: creds.pin, fullName: creds.fullName }),
  });
  const user: User = { id: data.id, email: data.email, fullName: data.fullName };
  return { token: 'cookie', user };
}

export async function guest(): Promise<AuthResponse> {
  const user: User = { id: 'guest', email: 'guest', guest: true };
  return { token: 'guest', user };
}

export function parseToken(token: string | null): any | null {
  return token;
}

export async function getMe(): Promise<User> {
  const data = await request<{ id: string; email: string; fullName?: string }>(`/auth/me`, { method: 'GET' });
  return { id: data.id, email: data.email, fullName: (data as any).fullName };
}

export async function refreshSession(): Promise<void> {
  await rawFetch(`/auth/refresh`, { method: 'POST' });
}

export async function apiLogout(): Promise<void> {
  await request(`/auth/logout`, { method: 'POST' });
}

export async function changePin(currentPin: string, newPin: string): Promise<{ message: string }> {
  return request(`/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPin, newPin }),
  });
}

export async function updateProfile(updates: { fullName?: string; email?: string }): Promise<User> {
  const data = await request<{ id: string; email: string; fullName?: string }>(`/auth/me`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return { id: data.id, email: data.email, fullName: data.fullName };
}

export async function deleteAccount(): Promise<{ message: string }> {
  return request(`/auth/me`, { method: 'DELETE' });
}

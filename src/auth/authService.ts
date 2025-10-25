export type Credentials = {
  identifier: string; // email or phone
  password: string;
};

export type User = {
  id: string;
  name?: string;
  identifier: string;
  guest?: boolean;
};

export type AuthResponse = {
  token: string;
  user: User;
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const makeToken = (payload: object) => {
  const data = { ...payload, iat: Date.now() };
  return btoa(JSON.stringify(data));
};

export async function login(creds: Credentials): Promise<AuthResponse> {
  await delay(400);
  if (!creds.identifier || !creds.password) {
    throw new Error('Please provide both identifier and password');
  }
  const user: User = {
    id: cryptoRandomId(),
    identifier: creds.identifier,
  };
  return { token: makeToken({ sub: user.id }), user };
}

export async function signup(creds: Credentials): Promise<AuthResponse> {
  await delay(500);
  if (!creds.identifier || !creds.password) {
    throw new Error('Please provide both identifier and password');
  }
  const user: User = {
    id: cryptoRandomId(),
    identifier: creds.identifier,
  };
  return { token: makeToken({ sub: user.id, new: true }), user };
}

export async function guest(): Promise<AuthResponse> {
  await delay(200);
  const user: User = { id: cryptoRandomId(), identifier: 'guest', guest: true };
  return { token: makeToken({ sub: user.id, guest: true }), user };
}

export function parseToken(token: string | null): any | null {
  if (!token) return null;
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

function cryptoRandomId() {
  // Simple random id for mock service
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

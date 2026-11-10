import type { AuthResponse } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Jeton d'accès gardé en mémoire uniquement (jamais dans localStorage) :
 * la session est prolongée par le cookie HttpOnly de rafraîchissement.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};

// Ancien stockage (v2) : on le supprime.
try {
  localStorage.removeItem('licorne.token');
} catch {
  /* stockage indisponible */
}

/** Callback appelé quand la session ne peut pas être renouvelée. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

const NETWORK_ERROR = 'Serveur injoignable. Vérifie ta connexion.';

/** Une seule demande de renouvellement à la fois, partagée entre les requêtes. */
let refreshing: Promise<AuthResponse | null> | null = null;

export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshing) {
    refreshing = (async () => {
      let response: Response;
      try {
        response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        throw new ApiError(NETWORK_ERROR, 0);
      }
      if (!response.ok) {
        tokenStore.clear();
        return null;
      }
      const session = (await response.json()) as AuthResponse;
      tokenStore.set(session.accessToken);
      return session;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function send(path: string, options: RequestInit): Promise<Response> {
  const token = tokenStore.get();
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await send(path, options);

  // Jeton d'accès expiré : on renouvelle la session une fois, puis on rejoue la requête.
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const session = await refreshSession().catch(() => null);
    if (session) response = await send(path, options);
  }

  if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    tokenStore.clear();
    onUnauthorized?.();
    throw new ApiError('Session expirée, reconnecte-toi.', 401);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 429) {
      throw new ApiError('Trop de tentatives. Patiente une minute avant de réessayer.', 429);
    }
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : (payload?.message ?? 'Une erreur est survenue. Réessaie dans un instant.');
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

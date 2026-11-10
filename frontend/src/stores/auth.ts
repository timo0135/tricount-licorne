import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '@/api';
import { refreshSession, tokenStore } from '@/api/client';
import type { User } from '@/api/types';

const USER_CACHE_KEY = 'lt.user';
const API_CACHE = 'lt-api';

/** Dernier profil connu, pour ouvrir l'application hors ligne. */
const userCache = {
  read(): User | null {
    try {
      const raw = localStorage.getItem(USER_CACHE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  write(user: User) {
    try {
      const { id, name, emoji, color, avatarUrl } = user;
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ id, name, emoji, color, avatarUrl }));
    } catch {
      /* stockage indisponible */
    }
  },
  clear() {
    try {
      localStorage.removeItem(USER_CACHE_KEY);
    } catch {
      /* stockage indisponible */
    }
  },
};

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const ready = ref(false);
  const loading = ref(false);
  /** Vrai si la session a été rouverte sans réseau (données en cache). */
  const offline = ref(false);

  const isAuthenticated = computed(() => Boolean(user.value));

  function setUser(next: User) {
    user.value = next;
    userCache.write(next);
  }

  /** Rouvre la session grâce au cookie de rafraîchissement. */
  async function restore() {
    try {
      const session = await refreshSession();
      if (session) {
        setUser(session.user);
        offline.value = false;
      } else {
        user.value = null;
        userCache.clear();
      }
    } catch {
      // Pas de réseau : on garde le dernier profil connu, les lectures viennent du cache.
      user.value = userCache.read();
      offline.value = Boolean(user.value);
    } finally {
      ready.value = true;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      const res = await authApi.login({ email, password });
      tokenStore.set(res.accessToken);
      setUser(res.user);
    } finally {
      loading.value = false;
    }
  }

  async function register(name: string, email: string, password: string) {
    loading.value = true;
    try {
      const res = await authApi.register({ name, email, password });
      tokenStore.set(res.accessToken);
      setUser(res.user);
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(payload: { name?: string; emoji?: string; color?: string }) {
    setUser(await authApi.updateProfile(payload));
  }

  async function setAvatar(file: Blob) {
    setUser(await authApi.setAvatar(file));
  }

  async function removeAvatar() {
    setUser(await authApi.removeAvatar());
  }

  /** Efface la session locale (jeton, profil en cache, réponses API en cache). */
  function clearLocal() {
    tokenStore.clear();
    user.value = null;
    userCache.clear();
    if ('caches' in window) {
      caches.delete(API_CACHE).catch(() => undefined);
      caches.delete('lt-images').catch(() => undefined);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      /* déconnexion locale malgré tout */
    }
    clearLocal();
  }

  return {
    user,
    ready,
    loading,
    offline,
    isAuthenticated,
    restore,
    login,
    register,
    updateProfile,
    setAvatar,
    removeAvatar,
    logout,
    clearLocal,
  };
});

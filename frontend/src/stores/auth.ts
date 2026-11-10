import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '@/api';
import { tokenStore } from '@/api/client';
import type { User } from '@/api/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const ready = ref(false);
  const loading = ref(false);

  const isAuthenticated = computed(() => Boolean(user.value));

  async function restore() {
    if (!tokenStore.get()) {
      ready.value = true;
      return;
    }
    try {
      user.value = await authApi.me();
    } catch {
      tokenStore.clear();
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      const res = await authApi.login({ email, password });
      tokenStore.set(res.accessToken);
      user.value = res.user;
    } finally {
      loading.value = false;
    }
  }

  async function register(name: string, email: string, password: string) {
    loading.value = true;
    try {
      const res = await authApi.register({ name, email, password });
      tokenStore.set(res.accessToken);
      user.value = res.user;
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(payload: { name?: string; emoji?: string; color?: string }) {
    user.value = await authApi.updateProfile(payload);
  }

  function logout() {
    tokenStore.clear();
    user.value = null;
  }

  return { user, ready, loading, isAuthenticated, restore, login, register, updateProfile, logout };
});

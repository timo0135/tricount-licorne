<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { RefreshCw, WifiOff } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const online = ref(navigator.onLine);

// Vérifie les mises à jour toutes les heures quand l'application reste ouverte.
const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update().catch(() => undefined), 3_600_000);
  },
});

async function onOnline() {
  online.value = true;
  if (auth.offline) {
    await auth.restore();
  }
}
const onOffline = () => (online.value = false);

// navigator.onLine n'est pas toujours fiable : tant que la session est hors ligne,
// on retente régulièrement de la rouvrir.
let retry: ReturnType<typeof setInterval> | undefined;
watch(
  () => auth.offline,
  (offline) => {
    clearInterval(retry);
    if (offline) retry = setInterval(() => auth.restore(), 15_000);
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
});
onBeforeUnmount(() => {
  clearInterval(retry);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
});
</script>

<template>
  <div class="pwa-status">
    <p v-if="!online || auth.offline" class="offline" role="status">
      <WifiOff :size="14" :stroke-width="2" />
      Hors ligne · dernières données connues, modifications indisponibles
    </p>

    <div v-if="needRefresh" class="update" role="status">
      <span class="grow">Une nouvelle version est disponible.</span>
      <button class="btn btn-sm" @click="updateServiceWorker(true)">
        <RefreshCw :size="14" :stroke-width="2" /> Mettre à jour
      </button>
    </div>
  </div>
</template>

<style scoped>
.pwa-status {
  position: sticky;
  top: 0;
  z-index: 30;
}

.offline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: calc(0.375rem + var(--safe-top)) 1rem 0.375rem;
  background: var(--text);
  color: var(--bg);
  font-size: var(--fs-xs);
  font-weight: 500;
}

.update {
  position: fixed;
  left: 50%;
  bottom: calc(5.25rem + var(--safe-bottom));
  transform: translateX(-50%);
  width: min(calc(100vw - 2rem), 440px);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.625rem 0.625rem 1rem;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-overlay);
  font-size: var(--fs-sm);
  font-weight: 500;
}
</style>

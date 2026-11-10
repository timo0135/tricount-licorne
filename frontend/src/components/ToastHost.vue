<script setup lang="ts">
import { useToastStore } from '@/stores/toast';

const toasts = useToastStore();
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="t in toasts.toasts" :key="t.id" class="toast" :class="t.type">
        <span>{{ t.type === 'success' ? '✨' : t.type === 'error' ? '💔' : '🦄' }}</span>
        <span class="grow">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: calc(0.8rem + var(--safe-top));
  left: 50%;
  transform: translateX(-50%);
  width: min(92vw, 480px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-lg);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
}

.toast.success {
  border-left: 4px solid var(--positif);
}

.toast.error {
  border-left: 4px solid var(--negatif);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.28s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}
</style>

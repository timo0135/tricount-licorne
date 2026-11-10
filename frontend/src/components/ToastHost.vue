<script setup lang="ts">
import { CircleAlert, CircleCheck, Info } from 'lucide-vue-next';
import { useToastStore } from '@/stores/toast';

const toasts = useToastStore();
const icons = { success: CircleCheck, error: CircleAlert, info: Info };
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts.toasts" :key="t.id" class="toast" :class="t.type" role="status">
        <component :is="icons[t.type]" :size="18" :stroke-width="2" class="icon" />
        <span class="grow">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: calc(0.75rem + var(--safe-top));
  left: 50%;
  transform: translateX(-50%);
  width: min(calc(100vw - 2rem), 440px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius);
  background: var(--text);
  color: var(--bg);
  box-shadow: var(--shadow-overlay);
  font-size: var(--fs-sm);
  font-weight: 500;
  line-height: 1.35;
}

.toast.success .icon {
  color: #4ade80;
}

.toast.error .icon {
  color: #f87171;
}

@media (prefers-color-scheme: dark) {
  .toast {
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border-strong);
  }
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

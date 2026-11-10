<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useConfirmStore } from '@/stores/confirm';

const confirm = useConfirmStore();
const confirmBtn = ref<HTMLButtonElement | null>(null);

watch(
  () => confirm.pending,
  async (value) => {
    if (value) {
      await nextTick();
      confirmBtn.value?.focus();
    }
  },
);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') confirm.answer(false);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="confirm.pending" class="scrim" @click.self="confirm.answer(false)" @keydown="onKey">
        <div
          class="sheet"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          <h2 id="confirm-title">{{ confirm.pending.title }}</h2>
          <p v-if="confirm.pending.message" id="confirm-message" class="muted">
            {{ confirm.pending.message }}
          </p>
          <div class="actions">
            <button
              ref="confirmBtn"
              class="btn btn-block"
              :class="{ 'btn-danger-solid': confirm.pending.danger }"
              @click="confirm.answer(true)"
            >
              {{ confirm.pending.confirmLabel ?? 'Confirmer' }}
            </button>
            <button class="btn btn-secondary btn-block" @click="confirm.answer(false)">
              {{ confirm.pending.cancelLabel ?? 'Annuler' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: var(--scrim);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: min(100%, var(--page-max));
  background: var(--surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 1.5rem 1rem calc(1rem + var(--safe-bottom));
  box-shadow: var(--shadow-overlay);
}

.sheet p {
  margin-top: 0.375rem;
  line-height: 1.45;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

@media (min-width: 640px) {
  .scrim {
    align-items: center;
  }

  .sheet {
    width: 400px;
    border-radius: var(--radius-lg);
    padding: 1.5rem;
  }
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.18s ease;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(24px);
}
</style>

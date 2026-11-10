import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** Boîte de confirmation intégrée, à la place de window.confirm(). */
export const useConfirmStore = defineStore('confirm', () => {
  const pending = ref<PendingConfirm | null>(null);

  function ask(options: ConfirmOptions): Promise<boolean> {
    pending.value?.resolve(false);
    return new Promise((resolve) => {
      pending.value = { ...options, resolve };
    });
  }

  function answer(value: boolean) {
    pending.value?.resolve(value);
    pending.value = null;
  }

  return { pending, ask, answer };
});

<script setup lang="ts">
import { computed } from 'vue';
import type { Expense } from '@/api/types';
import { categoryMeta, formatDateShort, formatMoney } from '@/utils/format';
import UnicornAvatar from './UnicornAvatar.vue';

const props = defineProps<{ expense: Expense; currency: string; currentUserId: string }>();

const meta = computed(() => categoryMeta(props.expense.category));

/** Ce que la dépense me coûte (ou me rapporte) au total. */
const myShare = computed(
  () => props.expense.shares.find((s) => s.user.id === props.currentUserId)?.amountCents ?? 0,
);

const iPaid = computed(() => props.expense.paidBy.id === props.currentUserId);

const myImpact = computed(() =>
  iPaid.value ? props.expense.amountCents - myShare.value : -myShare.value,
);
</script>

<template>
  <article class="card card-tight card-press expense">
    <span class="cat" :style="{ background: `${meta.color}33` }">{{ meta.emoji }}</span>

    <div class="grow">
      <div class="between">
        <h3 class="truncate">{{ expense.title }}</h3>
        <strong>{{ formatMoney(expense.amountCents, currency) }}</strong>
      </div>
      <div class="between">
        <p class="muted truncate">
          <UnicornAvatar :emoji="expense.paidBy.emoji" :color="expense.paidBy.color" :size="18" />
          {{ iPaid ? 'Toi' : expense.paidBy.name }} · {{ formatDateShort(expense.date) }}
        </p>
        <span
          class="faint"
          :class="myImpact >= 0 ? 'positive' : 'negative'"
          :title="myImpact >= 0 ? 'On te doit' : 'Tu dois'"
        >
          {{ myImpact >= 0 ? '+' : '' }}{{ formatMoney(myImpact, currency) }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.expense {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.cat {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

h3 {
  font-size: 0.98rem;
}

.muted {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
</style>

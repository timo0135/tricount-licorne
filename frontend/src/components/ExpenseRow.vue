<script setup lang="ts">
import { computed } from 'vue';
import type { Expense } from '@/api/types';
import { formatMoney } from '@/utils/format';
import CategoryIcon from './CategoryIcon.vue';

const props = defineProps<{ expense: Expense; currency: string; currentUserId: string }>();

const myShare = computed(
  () => props.expense.shares.find((s) => s.user.id === props.currentUserId)?.amountCents ?? 0,
);
const iPaid = computed(() => props.expense.paidBy.id === props.currentUserId);
const involved = computed(() => iPaid.value || myShare.value > 0);

/** Effet de la dépense sur mon solde : positif si on me doit, négatif si je dois. */
const myImpact = computed(() =>
  iPaid.value ? props.expense.amountCents - myShare.value : -myShare.value,
);

const payer = computed(() => (iPaid.value ? 'Toi' : props.expense.paidBy.name));
</script>

<template>
  <button class="list-row expense" type="button">
    <CategoryIcon :category="expense.category" />
    <div class="grow">
      <p class="list-title truncate">{{ expense.title }}</p>
      <p class="list-sub truncate">Payé par {{ payer }}</p>
    </div>
    <div class="amounts">
      <p class="amount num">{{ formatMoney(expense.amountCents, currency) }}</p>
      <p v-if="!involved" class="impact faint">non concerné</p>
      <p v-else-if="myImpact > 0" class="impact positive num">on te doit {{ formatMoney(myImpact, currency) }}</p>
      <p v-else-if="myImpact < 0" class="impact negative num">
        ta part {{ formatMoney(-myImpact, currency) }}
      </p>
      <p v-else class="impact faint">réglé</p>
    </div>
  </button>
</template>

<style scoped>
.amounts {
  text-align: right;
  flex-shrink: 0;
}

.amount {
  font-weight: 600;
  font-size: var(--fs-base);
  line-height: 1.3;
}

.impact {
  font-size: var(--fs-xs);
  margin-top: 0.125rem;
}
</style>

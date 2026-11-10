<script setup lang="ts">
import { computed } from 'vue';
import type { PartyBalance } from '@/api/types';
import { formatMoney } from '@/utils/format';
import PartyAvatar from './PartyAvatar.vue';

const props = defineProps<{ balance: PartyBalance; currency: string; max: number; isMe: boolean }>();

const cents = computed(() => props.balance.balanceCents);
const width = computed(() =>
  props.max === 0 ? 0 : Math.min(100, (Math.abs(cents.value) / props.max) * 100),
);
const status = computed(() =>
  cents.value > 0 ? 'à recevoir' : cents.value < 0 ? 'à rembourser' : 'à jour',
);
const isFamily = computed(() => props.balance.kind === 'family');
const title = computed(() =>
  props.isMe && !isFamily.value ? 'Toi' : props.balance.name,
);
const memberNames = computed(() => props.balance.members.map((m) => m.name).join(', '));
</script>

<template>
  <div class="list-row">
    <PartyAvatar :members="balance.members" :family="isFamily" :size="36" />
    <div class="grow">
      <div class="between">
        <p class="list-title truncate">
          {{ title }}<span v-if="isMe && isFamily" class="faint"> (ta famille)</span>
        </p>
        <p
          class="amount num"
          :class="{ positive: cents > 0, negative: cents < 0 }"
          :aria-label="`${formatMoney(Math.abs(cents), currency)} ${status}`"
        >
          {{ cents > 0 ? '+' : cents < 0 ? '−' : '' }}{{ formatMoney(Math.abs(cents), currency) }}
        </p>
      </div>
      <p v-if="isFamily" class="list-sub truncate">{{ memberNames }}</p>
      <div class="between">
        <p class="list-sub num truncate">
          a payé {{ formatMoney(balance.paidCents, currency) }} · part
          {{ formatMoney(balance.owedCents, currency) }}
        </p>
        <p class="list-sub status">{{ status }}</p>
      </div>
      <div class="track" aria-hidden="true">
        <div class="fill" :class="cents >= 0 ? 'up' : 'down'" :style="{ width: `${width}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.amount {
  font-weight: 600;
  white-space: nowrap;
}

.status {
  white-space: nowrap;
  flex-shrink: 0;
}

.track {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  margin-top: 0.5rem;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.4s ease;
}

.fill.up {
  background: var(--positive);
}

.fill.down {
  background: var(--negative);
}
</style>

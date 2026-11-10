<script setup lang="ts">
import { computed } from 'vue';
import type { Balance } from '@/api/types';
import { formatMoney } from '@/utils/format';
import UnicornAvatar from './UnicornAvatar.vue';

const props = defineProps<{ balance: Balance; currency: string; max: number; isMe: boolean }>();

const width = computed(() => {
  if (props.max === 0) return 0;
  return Math.min(100, (Math.abs(props.balance.balanceCents) / props.max) * 100);
});

const positive = computed(() => props.balance.balanceCents >= 0);
</script>

<template>
  <div class="balance">
    <UnicornAvatar
      :emoji="balance.user?.emoji"
      :color="balance.user?.color"
      :size="38"
      :ring="isMe"
    />
    <div class="grow">
      <div class="between">
        <span class="name truncate">{{ isMe ? 'Toi' : (balance.user?.name ?? 'Licorne') }}</span>
        <span :class="positive ? 'positive' : 'negative'" class="amount">
          {{ positive ? '+' : '' }}{{ formatMoney(balance.balanceCents, currency) }}
        </span>
      </div>
      <div class="track">
        <div
          class="fill"
          :class="positive ? 'fill-positive' : 'fill-negative'"
          :style="{ width: `${width}%` }"
        />
      </div>
      <p class="faint">
        a avancé {{ formatMoney(balance.paidCents, currency) }} · doit
        {{ formatMoney(balance.owedCents, currency) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.balance {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.55rem 0;
}

.name {
  font-weight: 700;
  font-size: 0.94rem;
}

.amount {
  font-weight: 700;
  font-size: 0.94rem;
}

.track {
  height: 7px;
  border-radius: var(--radius-full);
  background: rgba(185, 140, 245, 0.12);
  overflow: hidden;
  margin: 0.32rem 0 0.22rem;
}

.fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.fill-positive {
  background: linear-gradient(90deg, #7fe3cd, #2bb392);
}

.fill-negative {
  background: linear-gradient(90deg, #ffb3c8, #f2668b);
}
</style>

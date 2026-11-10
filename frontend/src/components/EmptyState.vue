<script setup lang="ts">
import type { Component } from 'vue';
import BrandMark from './BrandMark.vue';

defineProps<{ title: string; text?: string; icon?: Component }>();
</script>

<template>
  <div class="empty">
    <span class="illustration" aria-hidden="true">
      <component :is="icon" v-if="icon" :size="26" :stroke-width="1.75" />
      <BrandMark v-else :size="34" />
    </span>
    <h2>{{ title }}</h2>
    <p v-if="text" class="muted">{{ text }}</p>
    <div v-if="$slots.default" class="actions"><slot /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 2.5rem 1.5rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}

.illustration {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-text);
  margin-bottom: 0.5rem;
}

h2 {
  font-size: var(--fs-base);
}

p {
  max-width: 32ch;
}

.actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
}
</style>

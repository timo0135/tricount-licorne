<script setup lang="ts">
defineProps<{ emoji?: string; title: string; text?: string }>();
</script>

<template>
  <div class="empty card">
    <span class="emoji float">{{ emoji ?? '🦄' }}</span>
    <h2>{{ title }}</h2>
    <p v-if="text" class="muted">{{ text }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 2.2rem 1.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.emoji {
  font-size: 3rem;
}
</style>

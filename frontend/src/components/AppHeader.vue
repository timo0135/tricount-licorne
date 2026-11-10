<script setup lang="ts">
import { useRouter } from 'vue-router';

defineProps<{ title: string; subtitle?: string; back?: boolean }>();
const router = useRouter();

const goBack = () => {
  if (window.history.state?.back) router.back();
  else router.push('/');
};
</script>

<template>
  <header class="header">
    <button v-if="back" class="icon-btn" aria-label="Retour" @click="goBack">←</button>
    <div class="grow">
      <h1 class="truncate">{{ title }}</h1>
      <p v-if="subtitle" class="muted truncate">{{ subtitle }}</p>
    </div>
    <slot name="action" />
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}
</style>

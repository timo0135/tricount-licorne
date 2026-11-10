<script setup lang="ts">
import BrandMark from './BrandMark.vue';

defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <main class="page auth">
    <div class="brand">
      <span class="logo"><BrandMark :size="30" /></span>
      <span class="wordmark">Licorne Tricount</span>
    </div>

    <div class="intro">
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="muted">{{ subtitle }}</p>
    </div>

    <slot />

    <footer class="foot muted center"><slot name="footer" /></footer>
  </main>
</template>

<style scoped>
.auth {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100dvh;
  gap: 1.5rem;
  max-width: 420px;
  margin: 0 auto;
  padding-bottom: calc(2rem + var(--safe-bottom));
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
}

.wordmark {
  font-weight: 600;
  font-size: var(--fs-lg);
  letter-spacing: -0.02em;
}

.intro h1 {
  font-size: var(--fs-2xl);
  letter-spacing: -0.025em;
}

.intro p {
  margin-top: 0.375rem;
  font-size: var(--fs-base);
}
</style>

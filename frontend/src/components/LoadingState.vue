<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Chargement' });
</script>

<template>
  <div class="loading" role="status">
    <span class="spinner" aria-hidden="true" />
    <span class="muted">{{ label }}…</span>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 3rem 0;
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

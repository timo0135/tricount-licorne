<template>
  <div class="loader">
    <span class="sparkle">🦄</span>
    <p class="muted">Chargement…</p>
  </div>
</template>

<style scoped>
.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 0;
}

.sparkle {
  font-size: 2.4rem;
}
</style>

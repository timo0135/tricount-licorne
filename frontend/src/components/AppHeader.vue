<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';

const props = defineProps<{ title: string; subtitle?: string; back?: boolean | string }>();
const router = useRouter();

const goBack = () => {
  if (typeof props.back === 'string') router.push(props.back);
  else if (window.history.state?.back) router.back();
  else router.push('/');
};
</script>

<template>
  <header class="app-header">
    <button v-if="back" class="icon-btn back" aria-label="Retour" @click="goBack">
      <ArrowLeft :size="22" :stroke-width="1.75" />
    </button>
    <div class="grow titles">
      <h1 class="truncate">{{ title }}</h1>
      <p v-if="subtitle" class="muted truncate">{{ subtitle }}</p>
    </div>
    <slot name="action" />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 56px;
  margin-bottom: 0.75rem;
}

.back {
  margin-left: -0.5rem;
}

.titles {
  padding-left: 0.25rem;
}

h1 {
  font-size: var(--fs-lg);
}
</style>

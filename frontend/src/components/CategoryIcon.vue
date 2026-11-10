<script setup lang="ts">
import { computed } from 'vue';
import { categoryMeta, tintBg } from '@/utils/format';

const props = withDefaults(defineProps<{ category: string; size?: number }>(), { size: 40 });

const meta = computed(() => categoryMeta(props.category));
const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: tintBg(meta.value.color, 12),
  color: `color-mix(in srgb, ${meta.value.color} 80%, var(--text))`,
}));
</script>

<template>
  <span class="category-icon" :style="style" :title="meta.label">
    <component :is="meta.icon" :size="Math.round(size * 0.48)" :stroke-width="1.75" aria-hidden="true" />
    <span class="sr-only">{{ meta.label }}</span>
  </span>
</template>

<style scoped>
.category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}
</style>

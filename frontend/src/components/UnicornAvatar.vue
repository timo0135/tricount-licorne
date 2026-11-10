<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ emoji?: string; color?: string; size?: number; ring?: boolean }>(),
  { emoji: '🦄', color: '#C9A7F5', size: 40, ring: false },
);

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${props.size * 0.5}px`,
  background: `linear-gradient(135deg, ${props.color}, ${props.color}88)`,
  boxShadow: props.ring ? `0 0 0 3px #fff, 0 4px 12px ${props.color}66` : `0 4px 12px ${props.color}55`,
}));
</script>

<template>
  <span class="avatar" :style="style">{{ emoji }}</span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  line-height: 1;
  user-select: none;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { groupTint, tintBg } from '@/utils/format';

const props = withDefaults(defineProps<{ emoji?: string; tint?: string; size?: number }>(), {
  emoji: '🦄',
  tint: 'aurora',
  size: 44,
});

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.48)}px`,
  borderRadius: `${Math.round(props.size * 0.27)}px`,
  background: tintBg(groupTint(props.tint), 16),
}));
</script>

<template>
  <span class="group-avatar" :style="style" aria-hidden="true">{{ emoji }}</span>
</template>

<style scoped>
.group-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}
</style>

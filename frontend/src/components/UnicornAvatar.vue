<script setup lang="ts">
import { computed } from 'vue';

/** Avatar d'un membre : son emoji sur sa couleur, à plat. */
const props = withDefaults(
  defineProps<{ emoji?: string; color?: string; size?: number; ring?: boolean; label?: string }>(),
  { emoji: '🦄', color: '#c9a7f5', size: 40, ring: false, label: undefined },
);

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.5)}px`,
  background: props.color,
}));
</script>

<template>
  <span
    class="avatar"
    :class="{ ring }"
    :style="style"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    >{{ emoji }}</span
  >
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
  box-shadow: inset 0 0 0 1px rgba(28, 25, 23, 0.06);
}

.ring {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 4px var(--accent);
}
</style>

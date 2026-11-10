<script setup lang="ts">
import { computed, ref, watch } from 'vue';

/** Avatar d'un membre : sa photo si elle existe, sinon son emoji sur sa couleur. */
const props = withDefaults(
  defineProps<{
    emoji?: string;
    color?: string;
    photo?: string | null;
    size?: number;
    ring?: boolean;
    label?: string;
  }>(),
  { emoji: '🦄', color: '#c9a7f5', photo: null, size: 40, ring: false, label: undefined },
);

const failed = ref(false);
watch(
  () => props.photo,
  () => (failed.value = false),
);
const showPhoto = computed(() => Boolean(props.photo) && !failed.value);

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.5)}px`,
  background: showPhoto.value ? 'var(--surface-2)' : props.color,
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
  >
    <img
      v-if="showPhoto"
      :src="photo!"
      alt=""
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <template v-else>{{ emoji }}</template>
  </span>
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
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(28, 25, 23, 0.06);
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ring {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 4px var(--accent);
}
</style>

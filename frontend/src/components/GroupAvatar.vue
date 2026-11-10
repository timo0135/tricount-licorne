<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { groupTint, tintBg } from '@/utils/format';

const props = withDefaults(
  defineProps<{ emoji?: string; tint?: string; photo?: string | null; size?: number; ring?: boolean }>(),
  { emoji: '🦄', tint: 'aurora', photo: null, size: 44, ring: false },
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
  fontSize: `${Math.round(props.size * 0.48)}px`,
  borderRadius: `${Math.round(props.size * 0.27)}px`,
  background: showPhoto.value ? 'var(--surface-2)' : tintBg(groupTint(props.tint), 16),
}));
</script>

<template>
  <span class="group-avatar" :class="{ ring }" :style="style" aria-hidden="true">
    <img v-if="showPhoto" :src="photo!" alt="" loading="lazy" decoding="async" @error="failed = true" />
    <template v-else>{{ emoji }}</template>
  </span>
</template>

<style scoped>
.group-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  overflow: hidden;
}

.ring {
  box-shadow: 0 0 0 3px var(--surface);
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>

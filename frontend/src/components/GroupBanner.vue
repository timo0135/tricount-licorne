<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { groupTint, tintBg } from '@/utils/format';
import BrandMark from './BrandMark.vue';

/** Bannière 3:1 du troupeau : la photo choisie, sinon un aplat de sa couleur. */
const props = defineProps<{ url?: string | null; tint?: string }>();

const failed = ref(false);
watch(
  () => props.url,
  () => (failed.value = false),
);
const color = computed(() => groupTint(props.tint ?? 'aurora'));
</script>

<template>
  <div class="banner" :style="{ background: tintBg(color, 16) }">
    <img v-if="url && !failed" :src="url" alt="" decoding="async" @error="failed = true" />
    <span v-else class="mark" :style="{ color }" aria-hidden="true"><BrandMark :size="120" /></span>
  </div>
</template>

<style scoped>
.banner {
  position: relative;
  aspect-ratio: 3 / 1;
  overflow: hidden;
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mark {
  position: absolute;
  right: 6%;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.22;
}
</style>

<script setup lang="ts">
import { ref } from 'vue';
import { ImagePlus } from 'lucide-vue-next';

/** Bouton qui ouvre la galerie ou l'appareil photo, et émet l'image choisie. */
defineProps<{ label: string; busy?: boolean; variant?: 'secondary' | 'ghost' }>();
const emit = defineEmits<{ select: [file: File] }>();
const input = ref<HTMLInputElement | null>(null);

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) emit('select', file);
  target.value = '';
}
</script>

<template>
  <button
    type="button"
    class="btn btn-sm"
    :class="variant === 'ghost' ? 'btn-ghost' : 'btn-secondary'"
    :disabled="busy"
    @click="input?.click()"
  >
    <ImagePlus :size="16" :stroke-width="1.75" />
    {{ busy ? 'Envoi…' : label }}
  </button>
  <input
    ref="input"
    class="sr-only"
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
    tabindex="-1"
    aria-hidden="true"
    @change="onChange"
  />
</template>

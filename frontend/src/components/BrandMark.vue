<script setup lang="ts">
/** Logo : une tête de licorne au trait, dessinée à la main en SVG. */
withDefaults(defineProps<{ size?: number; title?: string }>(), { size: 32, title: undefined });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="title ? 'img' : undefined"
    :aria-hidden="title ? undefined : 'true'"
    class="brand-mark"
  >
    <title v-if="title">{{ title }}</title>
    <!-- Corne -->
    <path d="M17.4 10.3 23.8 3.2 19.7 12.1" />
    <!-- Tête et encolure -->
    <path
      d="M10 28.5C10 22 10.6 16 13 11.6L14.2 6.6 16.7 10.7C19.9 12.3 23.6 15.7 26.4 19.6 27.6 21.4 26.6 24 24.2 23.8 22 23.6 20 22.6 18.2 22.2 17.2 24.4 16.8 26.6 17.2 28.5"
    />
    <!-- Crinière -->
    <path d="M13 11.6C9.6 13 7.6 16.5 7.7 21.4" />
    <path d="M11.3 16.9C8.9 19.4 8.7 22.9 9.7 26" />
    <!-- Œil -->
    <circle cx="20.4" cy="15.8" r="0.9" fill="currentColor" stroke="none" />
  </svg>
</template>

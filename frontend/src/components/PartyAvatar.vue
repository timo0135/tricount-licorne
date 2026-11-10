<script setup lang="ts">
import { computed } from 'vue';
import type { User } from '@/api/types';
import UnicornAvatar from './UnicornAvatar.vue';

/** Avatar d'une entité : un membre seul, ou deux avatars superposés pour une famille. */
const props = withDefaults(
  defineProps<{ members: Partial<User>[]; family?: boolean; size?: number }>(),
  { family: false, size: 40 },
);

const shown = computed(() => props.members.slice(0, 2));
const extra = computed(() => Math.max(0, props.members.length - 2));
const small = computed(() => Math.round(props.size * 0.7));
</script>

<template>
  <UnicornAvatar
    v-if="!family || members.length < 2"
    :emoji="members[0]?.emoji"
    :color="members[0]?.color"
    :photo="members[0]?.avatarUrl"
    :size="size"
  />
  <span v-else class="stack" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <span class="first">
      <UnicornAvatar
        :emoji="shown[0]?.emoji"
        :color="shown[0]?.color"
        :photo="shown[0]?.avatarUrl"
        :size="small"
      />
    </span>
    <span class="second">
      <UnicornAvatar
        :emoji="shown[1]?.emoji"
        :color="shown[1]?.color"
        :photo="shown[1]?.avatarUrl"
        :size="small"
      />
    </span>
    <span v-if="extra" class="extra num">+{{ extra }}</span>
  </span>
</template>

<style scoped>
.stack {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

.first,
.second {
  position: absolute;
  display: inline-flex;
  border-radius: 50%;
}

.first {
  top: 0;
  left: 0;
}

.second {
  right: 0;
  bottom: 0;
  box-shadow: 0 0 0 2px var(--surface);
}

.extra {
  position: absolute;
  right: -4px;
  top: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--text);
  color: var(--bg);
  font-size: 10px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>

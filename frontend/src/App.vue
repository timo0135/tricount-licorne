<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ToastHost from '@/components/ToastHost.vue';
import { setUnauthorizedHandler } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';

const router = useRouter();
const auth = useAuthStore();
const groups = useGroupsStore();

onMounted(() => {
  setUnauthorizedHandler(() => {
    auth.logout();
    groups.reset();
    router.push({ name: 'login' });
  });
});
</script>

<template>
  <ToastHost />
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

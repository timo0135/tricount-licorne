<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ToastHost from '@/components/ToastHost.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
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
  <ConfirmDialog />
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

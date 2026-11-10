<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ToastHost from '@/components/ToastHost.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import PwaStatus from '@/components/PwaStatus.vue';
import DesktopSidebar from '@/components/DesktopSidebar.vue';
import { setUnauthorizedHandler } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useDesktop } from '@/utils/media';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const groups = useGroupsStore();
const isDesktop = useDesktop();

/** Barre latérale : sur ordinateur, une fois connecté. */
const withSidebar = computed(
  () => isDesktop.value && auth.isAuthenticated && !route.meta.public,
);

onMounted(() => {
  setUnauthorizedHandler(() => {
    auth.clearLocal();
    groups.reset();
    router.push({ name: 'login' });
  });
});
</script>

<template>
  <PwaStatus />
  <ToastHost />
  <ConfirmDialog />
  <div class="shell" :class="{ 'with-sidebar': withSidebar }">
    <DesktopSidebar v-if="withSidebar" />
    <div class="shell-main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

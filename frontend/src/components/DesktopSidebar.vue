<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Link2, Plus } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { formatMoney } from '@/utils/format';
import BrandMark from './BrandMark.vue';
import GroupAvatar from './GroupAvatar.vue';
import UnicornAvatar from './UnicornAvatar.vue';

const auth = useAuthStore();
const groups = useGroupsStore();
const route = useRoute();

onMounted(() => {
  if (!groups.groups.length) groups.fetchGroups().catch(() => undefined);
});

const isActive = (id: string) => route.params.id === id;
</script>

<template>
  <aside class="sidebar" aria-label="Navigation">
    <RouterLink to="/" class="brand">
      <span class="logo"><BrandMark :size="22" /></span>
      <span class="wordmark">Licorne Tricount</span>
    </RouterLink>

    <nav class="section" aria-labelledby="sidebar-groups">
      <RouterLink
        id="sidebar-groups"
        to="/"
        class="section-link"
        :class="{ active: route.name === 'groups' }"
      >
        Troupeaux
      </RouterLink>
      <ul class="groups">
        <li v-for="g in groups.groups" :key="g.id">
          <RouterLink
            :to="`/groups/${g.id}`"
            class="group-link"
            :class="{ active: isActive(g.id) }"
            :aria-current="isActive(g.id) ? 'page' : undefined"
          >
            <GroupAvatar :emoji="g.emoji" :tint="g.gradient" :photo="g.photoUrl" :size="28" />
            <span class="grow truncate">{{ g.name }}</span>
            <span
              class="balance num"
              :class="{ positive: g.myBalanceCents > 0, negative: g.myBalanceCents < 0 }"
            >
              {{ g.myBalanceCents > 0 ? '+' : g.myBalanceCents < 0 ? '−' : ''
              }}{{ formatMoney(Math.abs(g.myBalanceCents), g.currency) }}
            </span>
          </RouterLink>
        </li>
      </ul>
      <div class="actions">
        <RouterLink to="/groups/new" class="btn btn-sm btn-secondary">
          <Plus :size="16" :stroke-width="2" /> Nouveau
        </RouterLink>
        <RouterLink to="/groups/join" class="btn btn-sm btn-ghost">
          <Link2 :size="16" :stroke-width="2" /> Rejoindre
        </RouterLink>
      </div>
    </nav>

    <RouterLink to="/profile" class="profile" :class="{ active: route.name === 'profile' }">
      <UnicornAvatar
        :emoji="auth.user?.emoji"
        :color="auth.user?.color"
        :photo="auth.user?.avatarUrl"
        :size="32"
      />
      <span class="grow truncate">{{ auth.user?.name }}</span>
      <span class="faint">Profil</span>
    </RouterLink>
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem 0.75rem;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0 0.5rem;
  color: var(--text);
  text-decoration: none;
}

.logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
}

.wordmark {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.section {
  flex: 1;
  min-height: 0;
}

.section-link {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0.375rem 0.5rem;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-2);
  border-radius: var(--radius-sm);
  text-decoration: none;
}

.groups {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-link,
.profile {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 44px;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  color: var(--text);
  font-weight: 500;
  font-size: var(--fs-sm);
  text-decoration: none;
  transition: background-color 0.12s ease;
}

.group-link:hover,
.profile:hover,
.section-link:hover {
  background: var(--surface-2);
  text-decoration: none;
}

.group-link.active,
.profile.active,
.section-link.active {
  background: var(--accent-soft);
  color: var(--accent-text);
}

.balance {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--text-2);
}

.balance.positive {
  color: var(--positive);
}

.balance.negative {
  color: var(--negative);
}

.group-link.active .balance {
  color: var(--accent-text);
}

.actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem 0;
}

.actions .btn:hover {
  text-decoration: none;
}

.profile {
  border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  padding-top: 1rem;
}
</style>

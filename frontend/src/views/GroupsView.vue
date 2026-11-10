<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight, Link2, Plus } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { formatMoney } from '@/utils/format';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import GroupAvatar from '@/components/GroupAvatar.vue';
import EmptyState from '@/components/EmptyState.vue';
import LoadingState from '@/components/LoadingState.vue';

const auth = useAuthStore();
const groups = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

onMounted(async () => {
  try {
    await groups.fetchGroups();
  } catch (e) {
    toast.error((e as Error).message);
  }
});

/** Solde cumulé sur tous les troupeaux en euros (les autres devises sont ignorées). */
const globalBalance = computed(() =>
  groups.groups.filter((g) => g.currency === 'EUR').reduce((sum, g) => sum + g.myBalanceCents, 0),
);

const balanceLabel = (cents: number) =>
  cents > 0 ? 'à recevoir' : cents < 0 ? 'à rembourser' : 'à jour';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
</script>

<template>
  <main class="page">
    <header class="top">
      <div class="grow">
        <p class="muted">Bonjour {{ auth.user?.name }}</p>
        <h1>Troupeaux</h1>
      </div>
      <button class="avatar-btn" aria-label="Mon profil" @click="router.push('/profile')">
        <UnicornAvatar :emoji="auth.user?.emoji" :color="auth.user?.color" :size="40" />
      </button>
    </header>

    <LoadingState v-if="groups.loading && !groups.groups.length" />

    <template v-else-if="groups.groups.length">
      <section class="card summary">
        <p class="muted">Solde total</p>
        <p
          class="total num"
          :class="{ positive: globalBalance > 0, negative: globalBalance < 0 }"
        >
          {{ globalBalance > 0 ? '+' : globalBalance < 0 ? '−' : ''
          }}{{ formatMoney(Math.abs(globalBalance)) }}
        </p>
        <p class="muted">
          {{
            globalBalance > 0
              ? 'On te doit cette somme, tous troupeaux confondus.'
              : globalBalance < 0
                ? 'Tu dois cette somme, tous troupeaux confondus.'
                : 'Tous tes comptes sont à jour.'
          }}
        </p>
      </section>

      <h2 class="section-title">Mes troupeaux</h2>
      <div class="list">
        <RouterLink
          v-for="group in groups.groups"
          :key="group.id"
          :to="`/groups/${group.id}`"
          class="list-row"
        >
          <GroupAvatar :emoji="group.emoji" :tint="group.gradient" />
          <div class="grow">
            <p class="list-title truncate">{{ group.name }}</p>
            <p class="list-sub truncate">
              {{ plural(group.members.length, 'membre') }} ·
              {{ plural(group.expenseCount, 'dépense') }}
            </p>
          </div>
          <div class="balance">
            <p
              class="num amount"
              :class="{ positive: group.myBalanceCents > 0, negative: group.myBalanceCents < 0 }"
            >
              {{ group.myBalanceCents > 0 ? '+' : group.myBalanceCents < 0 ? '−' : ''
              }}{{ formatMoney(Math.abs(group.myBalanceCents), group.currency) }}
            </p>
            <p class="faint">{{ balanceLabel(group.myBalanceCents) }}</p>
          </div>
          <ChevronRight class="chevron" :size="18" />
        </RouterLink>
      </div>
    </template>

    <EmptyState
      v-else
      title="Aucun troupeau pour l'instant"
      text="Crée un troupeau pour ton groupe, ou rejoins-en un avec un code d'invitation."
    />

    <nav class="bottom-bar">
      <button class="btn btn-secondary grow" @click="router.push('/groups/join')">
        <Link2 :size="18" :stroke-width="2" /> Rejoindre
      </button>
      <button class="btn grow" @click="router.push('/groups/new')">
        <Plus :size="18" :stroke-width="2.25" /> Nouveau troupeau
      </button>
    </nav>
  </main>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 64px;
  margin-bottom: 1rem;
}

.top h1 {
  font-size: var(--fs-2xl);
  letter-spacing: -0.025em;
}

.avatar-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
}

.summary {
  margin-bottom: 1.5rem;
}

.total {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 0.125rem 0 0.25rem;
}

.balance {
  text-align: right;
  flex-shrink: 0;
}

.amount {
  font-weight: 600;
}
</style>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { formatMoney, gradientStyle } from '@/utils/format';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import EmptyState from '@/components/EmptyState.vue';
import LoadingUnicorn from '@/components/LoadingUnicorn.vue';

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

/** Solde global toutes prairies confondues (en EUR, devise majoritaire). */
const globalBalance = computed(() =>
  groups.groups.reduce((sum, g) => sum + g.myBalanceCents, 0),
);
</script>

<template>
  <main class="page">
    <header class="header">
      <div class="grow">
        <p class="muted">Coucou {{ auth.user?.name }} 👋</p>
        <h1>Mes troupeaux</h1>
      </div>
      <button class="avatar-btn" aria-label="Mon profil" @click="router.push('/profile')">
        <UnicornAvatar :emoji="auth.user?.emoji" :color="auth.user?.color" :size="44" />
      </button>
    </header>

    <section v-if="groups.groups.length" class="card summary" :style="{ background: 'var(--gradient-aurora)' }">
      <p class="summary-label">Solde global</p>
      <p class="summary-amount">
        {{ globalBalance > 0 ? '+' : '' }}{{ formatMoney(globalBalance) }}
      </p>
      <p class="summary-hint">
        {{
          globalBalance > 0
            ? 'On te doit des paillettes ✨'
            : globalBalance < 0
              ? 'Tu dois des paillettes 🪄'
              : 'Tout est équilibré 🌈'
        }}
      </p>
    </section>

    <LoadingUnicorn v-if="groups.loading && !groups.groups.length" />

    <div v-else class="stack list">
      <article
        v-for="group in groups.groups"
        :key="group.id"
        class="card card-tight card-press group"
        @click="router.push(`/groups/${group.id}`)"
      >
        <span class="cover" :style="{ background: gradientStyle(group.gradient) }">
          {{ group.emoji }}
        </span>

        <div class="grow">
          <div class="between">
            <h2 class="truncate">{{ group.name }}</h2>
            <span
              class="pill"
              :class="group.myBalanceCents >= 0 ? 'pill-positive' : 'pill-negative'"
            >
              {{ group.myBalanceCents > 0 ? '+' : ''
              }}{{ formatMoney(group.myBalanceCents, group.currency) }}
            </span>
          </div>
          <div class="between meta">
            <p class="muted truncate">
              {{ group.members.length }} licorne{{ group.members.length > 1 ? 's' : '' }} ·
              {{ group.expenseCount }} dépense{{ group.expenseCount > 1 ? 's' : '' }}
            </p>
            <p class="faint nowrap">{{ formatMoney(group.totalCents, group.currency) }} au total</p>
          </div>
          <div class="avatars">
            <UnicornAvatar
              v-for="m in group.members.slice(0, 5)"
              :key="m.id"
              :emoji="m.user.emoji"
              :color="m.user.color"
              :size="24"
              ring
            />
            <span v-if="group.members.length > 5" class="faint">
              +{{ group.members.length - 5 }}
            </span>
          </div>
        </div>
      </article>

      <EmptyState
        v-if="!groups.groups.length && !groups.loading"
        emoji="🌈"
        title="Aucun troupeau pour l'instant"
        text="Crée ta première prairie de dépenses ou rejoins celle d'une amie licorne."
      />
    </div>

    <nav class="dock">
      <button class="btn btn-ghost grow" @click="router.push('/groups/join')">
        🔗 Rejoindre
      </button>
      <button class="btn grow" @click="router.push('/groups/new')">✨ Nouveau</button>
    </nav>
  </main>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}

.avatar-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.summary {
  text-align: center;
  color: #fff;
  border: none;
  margin-bottom: 1rem;
  padding: 1.3rem;
}

.summary-label {
  font-size: 0.8rem;
  font-weight: 700;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-amount {
  font-size: 2.1rem;
  font-weight: 700;
  margin: 0.15rem 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.summary-hint {
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.95;
}

.group {
  display: flex;
  gap: 0.85rem;
  align-items: center;
}

.cover {
  width: 56px;
  height: 56px;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

h2 {
  font-size: 1.02rem;
}

.meta p {
  font-size: 0.78rem;
}

.nowrap {
  white-space: nowrap;
}

.avatars {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.35rem;
}

.dock {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, 520px);
  display: flex;
  gap: 0.6rem;
  padding: 0.8rem 1.1rem calc(0.9rem + var(--safe-bottom));
  background: linear-gradient(to top, var(--bg) 62%, transparent);
}
</style>

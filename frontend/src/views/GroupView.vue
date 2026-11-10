<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { groupsApi } from '@/api';
import { formatDate, formatMoney, gradientStyle } from '@/utils/format';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import ExpenseCard from '@/components/ExpenseCard.vue';
import BalanceRow from '@/components/BalanceRow.vue';
import EmptyState from '@/components/EmptyState.vue';
import LoadingUnicorn from '@/components/LoadingUnicorn.vue';

const props = defineProps<{ id: string }>();

const auth = useAuthStore();
const store = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

type Tab = 'expenses' | 'balances' | 'members';
const tab = ref<Tab>('expenses');
const inviteCode = ref('');

const group = computed(() => store.current);
const currency = computed(() => group.value?.currency ?? 'EUR');
const meId = computed(() => auth.user?.id ?? '');
const isOwner = computed(
  () => group.value?.members.find((m) => m.user.id === meId.value)?.role === 'OWNER',
);

const maxBalance = computed(() =>
  Math.max(1, ...(store.balances?.balances ?? []).map((b) => Math.abs(b.balanceCents))),
);

onMounted(async () => {
  try {
    await store.openGroup(props.id);
    inviteCode.value = store.current?.inviteCode ?? '';
  } catch (e) {
    toast.error((e as Error).message);
    router.replace('/');
  }
});

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    toast.success('Code copié ! Partage-le à tes licornes 🦄');
  } catch {
    toast.error('Copie impossible, note-le à la main 🪄');
  }
}

async function regenerate() {
  try {
    const res = await groupsApi.regenerateInvite(props.id);
    inviteCode.value = res.inviteCode;
    toast.success('Nouveau code généré ✨');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function removeExpense(expenseId: string) {
  if (!confirm('Supprimer cette dépense ?')) return;
  try {
    await store.deleteExpense(props.id, expenseId);
    toast.success('Dépense supprimée');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function removeSettlement(settlementId: string) {
  if (!confirm('Supprimer ce remboursement ?')) return;
  try {
    await store.deleteSettlement(props.id, settlementId);
    toast.success('Remboursement supprimé');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function leave() {
  if (!confirm('Quitter ce troupeau ?')) return;
  try {
    await store.leaveGroup(props.id, meId.value);
    toast.success('Tu as quitté le troupeau');
    router.replace('/');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function destroy() {
  if (!confirm('Supprimer définitivement ce troupeau et toutes ses dépenses ?')) return;
  try {
    await store.deleteGroup(props.id);
    toast.success('Troupeau supprimé');
    router.replace('/');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

const settlePrefill = (fromUserId: string, toUserId: string, amountCents: number) =>
  router.push({
    name: 'settle',
    params: { id: props.id },
    query: { from: fromUserId, to: toUserId, amount: String(amountCents) },
  });
</script>

<template>
  <main class="page">
    <LoadingUnicorn v-if="!group" />

    <template v-else>
      <AppHeader :title="group.name" :subtitle="group.description ?? undefined" back />

      <section class="hero card" :style="{ background: gradientStyle(group.gradient) }">
        <span class="hero-emoji">{{ group.emoji }}</span>
        <div class="hero-stats">
          <div>
            <p class="hero-label">Total dépensé</p>
            <p class="hero-value">{{ formatMoney(group.totalCents, currency) }}</p>
          </div>
          <div class="hero-sep" />
          <div>
            <p class="hero-label">Mon solde</p>
            <p class="hero-value">
              {{ group.myBalanceCents > 0 ? '+' : ''
              }}{{ formatMoney(group.myBalanceCents, currency) }}
            </p>
          </div>
        </div>
      </section>

      <nav class="tabs">
        <button class="chip" :class="{ active: tab === 'expenses' }" @click="tab = 'expenses'">
          🧾 Dépenses
        </button>
        <button class="chip" :class="{ active: tab === 'balances' }" @click="tab = 'balances'">
          ⚖️ Soldes
        </button>
        <button class="chip" :class="{ active: tab === 'members' }" @click="tab = 'members'">
          🦄 Licornes
        </button>
      </nav>

      <!-- ---------------- Dépenses ---------------- -->
      <section v-if="tab === 'expenses'" class="stack">
        <EmptyState
          v-if="!store.expenses.length"
          emoji="🧾"
          title="Aucune dépense"
          text="Ajoute la première dépense du troupeau et la magie du calcul opérera."
        />

        <div v-for="expense in store.expenses" :key="expense.id" class="swipe">
          <ExpenseCard
            :expense="expense"
            :currency="currency"
            :current-user-id="meId"
            @click="router.push(`/groups/${id}/expenses/${expense.id}`)"
          />
          <button class="trash" aria-label="Supprimer" @click.stop="removeExpense(expense.id)">
            🗑️
          </button>
        </div>
      </section>

      <!-- ---------------- Soldes ---------------- -->
      <section v-else-if="tab === 'balances'" class="stack">
        <div class="card">
          <h2>Qui a payé quoi</h2>
          <p class="muted">
            Moyenne par licorne :
            {{ formatMoney(store.balances?.averagePerMemberCents ?? 0, currency) }}
          </p>
          <div class="divider" />
          <BalanceRow
            v-for="b in store.balances?.balances ?? []"
            :key="b.userId"
            :balance="b"
            :currency="currency"
            :max="maxBalance"
            :is-me="b.userId === meId"
          />
        </div>

        <div class="card">
          <h2>Remboursements suggérés</h2>
          <p class="muted">Le minimum de virements pour tout remettre à zéro ✨</p>
          <div class="divider" />

          <p v-if="!store.balances?.reimbursements.length" class="center muted pad">
            Tout est équilibré, la prairie est sereine 🌈
          </p>

          <div
            v-for="(r, i) in store.balances?.reimbursements ?? []"
            :key="i"
            class="reimb"
          >
            <UnicornAvatar :emoji="r.fromUser?.emoji" :color="r.fromUser?.color" :size="34" />
            <div class="grow">
              <p class="reimb-text">
                <strong>{{ r.fromUserId === meId ? 'Toi' : r.fromUser?.name }}</strong>
                →
                <strong>{{ r.toUserId === meId ? 'toi' : r.toUser?.name }}</strong>
              </p>
              <p class="faint">{{ formatMoney(r.amountCents, currency) }}</p>
            </div>
            <UnicornAvatar :emoji="r.toUser?.emoji" :color="r.toUser?.color" :size="34" />
            <button
              class="btn btn-sm btn-soft"
              @click="settlePrefill(r.fromUserId, r.toUserId, r.amountCents)"
            >
              Régler
            </button>
          </div>
        </div>

        <div v-if="store.settlements.length" class="card">
          <h2>Remboursements enregistrés</h2>
          <div class="divider" />
          <div v-for="s in store.settlements" :key="s.id" class="settlement">
            <UnicornAvatar :emoji="s.fromUser.emoji" :color="s.fromUser.color" :size="30" />
            <div class="grow">
              <p class="reimb-text">
                {{ s.fromUser.name }} → {{ s.toUser.name }} ·
                <strong>{{ formatMoney(s.amountCents, currency) }}</strong>
              </p>
              <p class="faint">{{ formatDate(s.date) }}{{ s.note ? ` · ${s.note}` : '' }}</p>
            </div>
            <button class="trash-inline" aria-label="Supprimer" @click="removeSettlement(s.id)">
              🗑️
            </button>
          </div>
        </div>
      </section>

      <!-- ---------------- Membres ---------------- -->
      <section v-else class="stack">
        <article
          class="card card-tight card-press coeff-card"
          @click="router.push(`/groups/${id}/coefficients`)"
        >
          <span class="coeff-icon">⚖️</span>
          <div class="grow">
            <h2>Coefficients</h2>
            <p class="muted">Qui paie quelle part, thème par thème</p>
          </div>
          <span class="chevron">›</span>
        </article>

        <div class="card">
          <h2>Code d'invitation</h2>
          <p class="muted">Partage-le pour faire entrer d'autres licornes dans le troupeau.</p>
          <div class="invite">
            <code>{{ inviteCode }}</code>
            <button class="icon-btn" aria-label="Copier" @click="copyInvite">📋</button>
          </div>
          <button v-if="isOwner" class="btn btn-sm btn-ghost" @click="regenerate">
            🔄 Régénérer le code
          </button>
        </div>

        <div class="card">
          <h2>Le troupeau ({{ group.members.length }})</h2>
          <div class="divider" />
          <div v-for="m in group.members" :key="m.id" class="member">
            <UnicornAvatar
              :emoji="m.user.emoji"
              :color="m.user.color"
              :size="40"
              :ring="m.user.id === meId"
            />
            <div class="grow">
              <p class="member-name">
                {{ m.user.name }}
                <span v-if="m.user.id === meId" class="faint">(toi)</span>
              </p>
              <p class="faint">{{ m.role === 'OWNER' ? '👑 Créatrice' : 'Membre' }}</p>
            </div>
          </div>
        </div>

        <button class="btn btn-ghost btn-block" @click="leave">🚪 Quitter le troupeau</button>
        <button v-if="isOwner" class="btn btn-danger btn-block" @click="destroy">
          🗑️ Supprimer le troupeau
        </button>
      </section>

      <button
        v-if="tab !== 'members'"
        class="fab"
        aria-label="Ajouter"
        @click="
          tab === 'expenses'
            ? router.push(`/groups/${id}/expenses/new`)
            : router.push(`/groups/${id}/settle`)
        "
      >
        {{ tab === 'expenses' ? '＋' : '💸' }}
      </button>
    </template>
  </main>
</template>

<style scoped>
.hero {
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.hero-emoji {
  font-size: 2.4rem;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex: 1;
}

.hero-sep {
  width: 1px;
  height: 34px;
  background: rgba(255, 255, 255, 0.45);
}

.hero-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.9;
}

.hero-value {
  font-size: 1.15rem;
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: 0.45rem;
  margin-bottom: 0.9rem;
}

.tabs .chip {
  flex: 1;
  justify-content: center;
}

.swipe {
  position: relative;
}

.trash {
  position: absolute;
  top: 50%;
  right: -6px;
  transform: translateY(-50%);
  opacity: 0;
  pointer-events: none;
  border: none;
  background: none;
  font-size: 1rem;
  cursor: pointer;
}

.swipe:hover .trash {
  opacity: 0.75;
  pointer-events: auto;
  right: 8px;
  transition: all 0.18s ease;
}

.reimb,
.settlement,
.member {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0;
}

.reimb-text {
  font-size: 0.9rem;
}

.member-name {
  font-size: 0.94rem;
  font-weight: 700;
}

.trash-inline {
  border: none;
  background: none;
  cursor: pointer;
  opacity: 0.55;
  font-size: 0.95rem;
}

.coeff-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.coeff-icon {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  background: var(--lilas-soft);
  flex-shrink: 0;
}

.chevron {
  font-size: 1.5rem;
  color: var(--ink-faint);
}

.invite {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.7rem 0;
}

.invite code {
  flex: 1;
  font-family: inherit;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-align: center;
  padding: 0.7rem;
  border-radius: var(--radius);
  background: var(--lilas-soft);
  color: #6d47b8;
}

.pad {
  padding: 0.6rem 0;
}

.fab {
  position: fixed;
  bottom: calc(1.2rem + var(--safe-bottom));
  left: 50%;
  transform: translateX(calc(260px - 100%));
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  background: var(--gradient-main);
  color: #fff;
  font-size: 1.6rem;
  font-weight: 700;
  box-shadow: var(--shadow-lg), var(--glow);
  cursor: pointer;
  transition: transform 0.18s ease;
  z-index: 20;
}

.fab:active {
  transform: translateX(calc(260px - 100%)) scale(0.93);
}

@media (max-width: 520px) {
  .fab {
    left: auto;
    right: 1.1rem;
    transform: none;
  }
  .fab:active {
    transform: scale(0.93);
  }
}
</style>

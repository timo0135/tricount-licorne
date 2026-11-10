<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowRight,
  ChevronRight,
  Copy,
  LogOut,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  Share2,
  SlidersHorizontal,
  Trash2,
  UsersRound,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { useConfirmStore } from '@/stores/confirm';
import { groupsApi } from '@/api';
import type { Expense, PartyInfo, Reimbursement, User } from '@/api/types';
import { dayLabel, displayName, formatDate, formatMoney } from '@/utils/format';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import GroupAvatar from '@/components/GroupAvatar.vue';
import GroupBanner from '@/components/GroupBanner.vue';
import PartyAvatar from '@/components/PartyAvatar.vue';
import ExpenseRow from '@/components/ExpenseRow.vue';
import BalanceRow from '@/components/BalanceRow.vue';
import EmptyState from '@/components/EmptyState.vue';
import LoadingState from '@/components/LoadingState.vue';
import { useDesktop } from '@/utils/media';

const props = defineProps<{ id: string }>();

const auth = useAuthStore();
const store = useGroupsStore();
const toast = useToastStore();
const confirm = useConfirmStore();
const router = useRouter();
const route = useRoute();

type Tab = 'expenses' | 'balances' | 'members';
const tabs: { key: Tab; label: string }[] = [
  { key: 'expenses', label: 'Dépenses' },
  { key: 'balances', label: 'Soldes' },
  { key: 'members', label: 'Membres' },
];
const initialTab = route.query.tab as Tab | undefined;
const tab = ref<Tab>(initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : 'expenses');
const inviteCode = ref('');
const isDesktop = useDesktop();

/** Sur ordinateur, les dépenses sont toujours visibles ; le panneau de droite alterne. */
const sideTabs = tabs.filter((t) => t.key !== 'expenses');
const sideTab = computed<Tab>(() =>
  isDesktop.value && tab.value === 'expenses' ? 'balances' : tab.value,
);

const group = computed(() => store.current);
const currency = computed(() => group.value?.currency ?? 'EUR');
const meId = computed(() => auth.user?.id ?? '');
const isOwner = computed(
  () => group.value?.members.find((m) => m.user.id === meId.value)?.role === 'OWNER',
);
const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

const maxBalance = computed(() =>
  Math.max(1, ...(store.balances?.balances ?? []).map((b) => Math.abs(b.balanceCents))),
);

/** Dépenses regroupées par jour, la plus récente en premier. */
const expensesByDay = computed(() => {
  const groups: { label: string; items: Expense[] }[] = [];
  for (const expense of store.expenses) {
    const label = dayLabel(expense.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(expense);
    else groups.push({ label, items: [expense] });
  }
  return groups;
});

const myBalance = computed(() => group.value?.myBalanceCents ?? 0);

/** Familles du troupeau avec leurs membres. */
const families = computed(() =>
  (group.value?.families ?? []).map((f) => ({
    ...f,
    members: (group.value?.members ?? []).filter((m) => m.familyId === f.id).map((m) => m.user),
  })),
);
const familyName = (familyId: string | null) =>
  families.value.find((f) => f.id === familyId)?.name ?? '';

const includesMe = (party: { members: User[] }) => party.members.some((m) => m.id === meId.value);
/** « Toi » pour un membre seul qui est l'utilisateur, sinon le nom de l'entité. */
const partyLabel = (party: PartyInfo) =>
  party.kind === 'member' && includesMe(party) ? 'Toi' : party.name;

onMounted(async () => {
  try {
    await store.openGroup(props.id);
    inviteCode.value = store.current?.inviteCode ?? '';
  } catch (e) {
    toast.error((e as Error).message);
    router.replace('/');
  }
});

function selectTab(next: Tab) {
  tab.value = next;
  router.replace({ query: next === 'expenses' ? {} : { tab: next } });
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    toast.success('Code copié');
  } catch {
    toast.error('Copie impossible : sélectionne le code pour le copier.');
  }
}

async function shareInvite() {
  try {
    await navigator.share({
      title: group.value?.name,
      text: `Rejoins « ${group.value?.name} » sur Licorne Tricount avec le code ${inviteCode.value}`,
      url: `${window.location.origin}/groups/join?code=${inviteCode.value}`,
    });
  } catch {
    /* partage annulé */
  }
}

async function regenerate() {
  const ok = await confirm.ask({
    title: 'Générer un nouveau code ?',
    message: "L'ancien code ne fonctionnera plus.",
    confirmLabel: 'Générer',
  });
  if (!ok) return;
  try {
    const res = await groupsApi.regenerateInvite(props.id);
    inviteCode.value = res.inviteCode;
    toast.success('Nouveau code généré');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function removeSettlement(settlementId: string) {
  const ok = await confirm.ask({
    title: 'Supprimer ce remboursement ?',
    message: 'Les soldes seront recalculés.',
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    await store.deleteSettlement(props.id, settlementId);
    toast.success('Remboursement supprimé');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function leave() {
  const ok = await confirm.ask({
    title: 'Quitter ce troupeau ?',
    message:
      myBalance.value !== 0
        ? `Ton solde n'est pas à zéro (${formatMoney(myBalance.value, currency.value)}). Tes dépenses passées restent dans le troupeau.`
        : 'Tes dépenses passées restent dans le troupeau.',
    confirmLabel: 'Quitter',
    danger: true,
  });
  if (!ok) return;
  try {
    await store.leaveGroup(props.id, meId.value);
    toast.success('Tu as quitté le troupeau');
    router.replace('/');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function destroy() {
  const ok = await confirm.ask({
    title: 'Supprimer le troupeau ?',
    message: 'Toutes les dépenses et tous les remboursements seront effacés. Cette action est définitive.',
    confirmLabel: 'Supprimer définitivement',
    danger: true,
  });
  if (!ok) return;
  try {
    await store.deleteGroup(props.id);
    toast.success('Troupeau supprimé');
    router.replace('/');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

/** Pré-remplit le remboursement ; si je fais partie de l'entité qui paie, c'est moi qui paie. */
const settlePrefill = (r: Reimbursement) =>
  router.push({
    name: 'settle',
    params: { id: props.id },
    query: {
      from: includesMe(r.from) ? meId.value : r.fromUserId,
      to: r.toUserId,
      amount: String(r.amountCents),
    },
  });
</script>

<template>
  <main class="page" :class="{ 'page-wide': isDesktop }">
    <AppHeader back="/">
      <template #action>
        <RouterLink
          v-if="group"
          :to="`/groups/${id}/settings`"
          class="icon-btn"
          aria-label="Réglages du troupeau"
        >
          <Settings :size="20" :stroke-width="1.75" />
        </RouterLink>
      </template>
    </AppHeader>

    <LoadingState v-if="!group" />

    <template v-else>
      <section class="hero card">
        <GroupBanner :url="group.bannerUrl" :tint="group.gradient" />
        <div class="hero-body">
          <GroupAvatar
            class="hero-avatar"
            :emoji="group.emoji"
            :tint="group.gradient"
            :photo="group.photoUrl"
            :size="64"
            ring
          />
          <h1 class="hero-title">{{ group.name }}</h1>
          <p v-if="group.description" class="muted hero-desc">{{ group.description }}</p>
          <div class="overview">
            <div>
              <p class="muted">Total des dépenses</p>
              <p class="figure num">{{ formatMoney(group.totalCents, currency) }}</p>
            </div>
            <div class="sep" />
            <div>
              <p class="muted">{{ group.members.find((m) => m.user.id === meId)?.familyId ? 'Solde de ta famille' : 'Ton solde' }}</p>
              <p class="figure num" :class="{ positive: myBalance > 0, negative: myBalance < 0 }">
                {{ myBalance > 0 ? '+' : myBalance < 0 ? '−' : '' }}{{ formatMoney(Math.abs(myBalance), currency) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div class="segmented tabs mobile-only" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.key"
          role="tab"
          :aria-selected="tab === t.key"
          :class="{ active: tab === t.key }"
          @click="selectTab(t.key)"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Dépenses -->
      <div class="group-grid">
      <section v-if="isDesktop || tab === 'expenses'" class="stack col-main">
        <div class="section-head desktop-only">
          <h2 class="column-title">Dépenses</h2>
          <button class="btn btn-sm" @click="router.push(`/groups/${id}/expenses/new`)">
            <Plus :size="16" :stroke-width="2.25" /> Ajouter une dépense
          </button>
        </div>
        <EmptyState
          v-if="!store.expenses.length"
          :icon="Receipt"
          title="Aucune dépense"
          text="Ajoute la première dépense : elle sera répartie selon les coefficients du troupeau."
        />

        <div v-for="day in expensesByDay" :key="day.label">
          <h2 class="section-title day">{{ day.label }}</h2>
          <div class="list">
            <ExpenseRow
              v-for="expense in day.items"
              :key="expense.id"
              :expense="expense"
              :currency="currency"
              :current-user-id="meId"
              @click="router.push(`/groups/${id}/expenses/${expense.id}`)"
            />
          </div>
        </div>
      </section>

      <!-- Soldes -->
      <div v-if="isDesktop || tab !== 'expenses'" class="col-side stack">
      <div class="segmented desktop-only" role="tablist" aria-label="Panneau latéral">
        <button
          v-for="t in sideTabs"
          :key="t.key"
          role="tab"
          :aria-selected="sideTab === t.key"
          :class="{ active: sideTab === t.key }"
          @click="selectTab(t.key)"
        >
          {{ t.label }}
        </button>
      </div>
      <section v-if="sideTab === 'balances'" class="stack">
        <button
          class="btn btn-secondary btn-block desktop-only"
          @click="router.push(`/groups/${id}/settle`)"
        >
          <Plus :size="16" :stroke-width="2.25" /> Enregistrer un remboursement
        </button>
        <div>
          <div class="section-head">
            <h2 class="section-title">Soldes</h2>
            <span class="faint num">
              moyenne {{ formatMoney(store.balances?.averagePerPartyCents ?? 0, currency) }}
              {{ group.families.length ? '/ entité' : '/ membre' }}
            </span>
          </div>
          <div class="list">
            <BalanceRow
              v-for="b in store.balances?.balances ?? []"
              :key="b.partyId"
              :balance="b"
              :currency="currency"
              :max="maxBalance"
              :is-me="includesMe(b)"
            />
          </div>
        </div>

        <div>
          <h2 class="section-title">Remboursements suggérés</h2>
          <div v-if="store.balances?.reimbursements.length" class="list">
            <div v-for="(r, i) in store.balances.reimbursements" :key="i" class="list-row">
              <div class="pair" aria-hidden="true">
                <PartyAvatar :members="r.from.members" :family="r.from.kind === 'family'" :size="28" />
                <ArrowRight :size="14" class="faint" />
                <PartyAvatar :members="r.to.members" :family="r.to.kind === 'family'" :size="28" />
              </div>
              <div class="grow">
                <p class="list-title truncate">{{ partyLabel(r.from) }} → {{ partyLabel(r.to) }}</p>
                <p class="list-sub num">{{ formatMoney(r.amountCents, currency) }}</p>
              </div>
              <button class="btn btn-sm btn-secondary" @click="settlePrefill(r)">
                Régler
              </button>
            </div>
          </div>
          <p v-else class="alert alert-info">Tout le monde est à jour, aucun remboursement à faire.</p>
          <p v-if="store.balances?.reimbursements.length" class="hint note">
            Le plus petit nombre de virements pour remettre tous les soldes à zéro.
          </p>
        </div>

        <div v-if="store.settlements.length">
          <h2 class="section-title">Remboursements enregistrés</h2>
          <div class="list">
            <div v-for="s in store.settlements" :key="s.id" class="list-row">
              <div class="grow">
                <p class="list-title truncate">
                  {{ displayName(s.fromUser, meId) }} → {{ displayName(s.toUser, meId) }}
                </p>
                <p class="list-sub truncate">
                  {{ formatDate(s.date) }}{{ s.note ? ` · ${s.note}` : '' }}
                </p>
              </div>
              <p class="num amount">{{ formatMoney(s.amountCents, currency) }}</p>
              <button class="icon-btn" aria-label="Supprimer ce remboursement" @click="removeSettlement(s.id)">
                <Trash2 :size="18" :stroke-width="1.75" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Membres -->
      <section v-else class="stack">
        <div class="list">
          <RouterLink :to="`/groups/${id}/coefficients`" class="list-row">
            <span class="tile"><SlidersHorizontal :size="20" :stroke-width="1.75" /></span>
            <div class="grow">
              <p class="list-title">Coefficients</p>
              <p class="list-sub">La part de chacun, catégorie par catégorie</p>
            </div>
            <ChevronRight class="chevron" :size="18" />
          </RouterLink>
        </div>

        <div class="card">
          <p class="label">Code d'invitation</p>
          <div class="invite">
            <code class="code num">{{ inviteCode }}</code>
            <button class="icon-btn bordered" aria-label="Copier le code" @click="copyInvite">
              <Copy :size="18" :stroke-width="1.75" />
            </button>
            <button v-if="canShare" class="icon-btn bordered" aria-label="Partager" @click="shareInvite">
              <Share2 :size="18" :stroke-width="1.75" />
            </button>
          </div>
          <p class="hint">Partage ce code pour inviter quelqu'un dans le troupeau.</p>
          <button v-if="isOwner" class="text-btn regen" @click="regenerate">
            <RefreshCw :size="14" :stroke-width="2" /> Générer un nouveau code
          </button>
        </div>

        <div>
          <div class="section-head">
            <h2 class="section-title">Familles</h2>
            <RouterLink :to="`/groups/${id}/families/new`" class="text-btn">Créer une famille</RouterLink>
          </div>
          <div v-if="families.length" class="list">
            <RouterLink
              v-for="f in families"
              :key="f.id"
              :to="`/groups/${id}/families/${f.id}`"
              class="list-row"
            >
              <PartyAvatar :members="f.members" family :size="36" />
              <div class="grow">
                <p class="list-title truncate">{{ f.name }}</p>
                <p class="list-sub truncate">{{ f.members.map((u) => u.name).join(', ') }}</p>
              </div>
              <ChevronRight class="chevron" :size="18" />
            </RouterLink>
          </div>
          <p v-else class="alert alert-info family-hint">
            <UsersRound :size="16" :stroke-width="1.75" />
            Regroupe les membres d'une même famille : ils auront un coefficient, un solde et des
            remboursements communs.
          </p>
        </div>

        <div>
          <h2 class="section-title">{{ group.members.length }} membre{{ group.members.length > 1 ? 's' : '' }}</h2>
          <div class="list">
            <div v-for="m in group.members" :key="m.id" class="list-row">
              <UnicornAvatar
                :emoji="m.user.emoji"
                :color="m.user.color"
                :photo="m.user.avatarUrl"
                :size="36"
              />
              <div class="grow">
                <p class="list-title truncate">
                  {{ m.user.name }}<span v-if="m.user.id === meId" class="faint"> (toi)</span>
                </p>
                <p v-if="m.familyId" class="list-sub truncate">{{ familyName(m.familyId) }}</p>
              </div>
              <span v-if="m.role === 'OWNER'" class="badge">Créateur</span>
            </div>
          </div>
        </div>

        <div class="stack-sm">
          <button class="btn btn-danger btn-block" @click="leave">
            <LogOut :size="18" :stroke-width="1.75" /> Quitter le troupeau
          </button>
          <button v-if="isOwner" class="btn btn-danger btn-block" @click="destroy">
            <Trash2 :size="18" :stroke-width="1.75" /> Supprimer le troupeau
          </button>
        </div>
      </section>
      </div>
      </div>

      <nav v-if="!isDesktop && tab !== 'members'" class="bottom-bar">
        <button
          v-if="tab === 'expenses'"
          class="btn btn-block"
          @click="router.push(`/groups/${id}/expenses/new`)"
        >
          <Plus :size="18" :stroke-width="2.25" /> Ajouter une dépense
        </button>
        <button v-else class="btn btn-block" @click="router.push(`/groups/${id}/settle`)">
          <Plus :size="18" :stroke-width="2.25" /> Enregistrer un remboursement
        </button>
      </nav>
    </template>
  </main>
</template>

<style scoped>
.hero {
  padding: 0;
  overflow: hidden;
  margin-bottom: 1rem;
}

.hero-body {
  padding: 0 1rem 1rem;
}

.hero-avatar {
  margin-top: -32px;
  position: relative;
}

.hero-title {
  font-size: var(--fs-xl);
  letter-spacing: -0.02em;
  margin-top: 0.5rem;
}

.hero-desc {
  margin-top: 0.125rem;
}

.overview {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.family-hint {
  align-items: flex-start;
}

.overview > div:not(.sep) {
  flex: 1;
  min-width: 0;
}

.sep {
  width: 1px;
  align-self: stretch;
  background: var(--border);
}

.figure {
  font-size: clamp(1.125rem, 5.6vw, var(--fs-xl));
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-top: 0.125rem;
  white-space: nowrap;
}

.tabs {
  margin-bottom: 1.25rem;
}

.column-title {
  font-size: var(--fs-lg);
}

@media (min-width: 1024px) {
  .hero :deep(.banner) {
    aspect-ratio: auto;
    height: 200px;
  }

  .hero-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 2rem;
    padding: 0 1.5rem 1.25rem;
  }

  .hero-avatar,
  .hero-title,
  .hero-desc {
    grid-column: 1;
  }

  /* Chiffres clés à droite du titre, sans cadre : la carte suffit. */
  .overview {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: end;
    gap: 1.5rem;
    margin-top: 0;
    padding: 0;
    border: none;
    text-align: right;
  }

  .hero {
    margin-bottom: 1.75rem;
  }

  .group-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    gap: 2rem;
    align-items: start;
  }

    .col-main .section-head {
    margin-bottom: 0.25rem;
  }
}

.day::first-letter {
  text-transform: uppercase;
}

.pair {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.amount {
  font-weight: 600;
  white-space: nowrap;
}

.note {
  margin: 0.5rem 0.25rem 0;
}

.tile {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-text);
  flex-shrink: 0;
}

.invite {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.code {
  flex: 1;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  user-select: all;
}

.regen {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding-left: 0;
}
</style>

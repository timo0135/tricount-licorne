<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { expensesApi } from '@/api';
import type { ExpenseParticipantPayload, SplitMode } from '@/api/types';
import {
  CATEGORY_META,
  TOTAL_BP,
  categoryMeta,
  centsToInput,
  formatMoney,
  formatPercent,
  parseAmountToCents,
  splitCents,
  toDateInput,
} from '@/utils/format';
import { Check, CircleAlert, Minus, Pencil, Plus, Trash2, Wand2 } from 'lucide-vue-next';
import { useConfirmStore } from '@/stores/confirm';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import PartyAvatar from '@/components/PartyAvatar.vue';
import CategoryIcon from '@/components/CategoryIcon.vue';
import LoadingState from '@/components/LoadingState.vue';

const props = defineProps<{ id: string; expenseId?: string }>();

const auth = useAuthStore();
const store = useGroupsStore();
const toast = useToastStore();
const confirm = useConfirmStore();
const router = useRouter();

interface ParticipantRow {
  userId: string;
  name: string;
  emoji: string;
  color: string;
  photo: string | null;
  selected: boolean;
  weight: number;
  amount: string;
}

const amount = ref('');
const title = ref('');
const category = ref('autre');
const paidById = ref('');
const date = ref(new Date().toISOString().slice(0, 10));
const note = ref('');
const splitMode = ref<SplitMode>('AUTO');
/** Vrai dès qu'on sort du mode automatique pour cette dépense. */
const customized = ref(false);
const rows = ref<ParticipantRow[]>([]);
const saving = ref(false);
const error = ref('');
const isEdit = computed(() => Boolean(props.expenseId));

const group = computed(() => (store.current?.id === props.id ? store.current : null));
const currencySymbol = computed(() => (currency.value === 'EUR' ? '€' : currency.value));
const modes: { key: SplitMode; label: string }[] = [
  { key: 'EQUAL', label: 'Égal' },
  { key: 'SHARES', label: 'Par parts' },
  { key: 'EXACT', label: 'Montants' },
];
const currency = computed(() => group.value?.currency ?? 'EUR');
const totalCents = computed(() => parseAmountToCents(amount.value));
const selectedRows = computed(() => rows.value.filter((r) => r.selected));

/** Coefficients du troupeau pour la catégorie choisie (points de base). */
const autoWeights = computed<Map<string, number>>(() => {
  const entry = store.coefficients?.categories.find((c) => c.category === category.value);
  return new Map((entry?.memberShares ?? []).map((s) => [s.userId, s.shareBp]));
});

/**
 * Aperçu de la répartition automatique par entité : une famille est une seule
 * ligne (son coefficient est la somme de ceux de ses membres).
 */
const autoParties = computed(() => {
  const matrix = store.coefficients;
  if (!matrix) return [];
  const entry = matrix.categories.find((c) => c.category === category.value);
  const rows = matrix.parties.map((party) => ({
    party,
    bp: entry?.shares.find((s) => s.partyId === party.id)?.shareBp ?? 0,
    users: party.userIds
      .map((id) => matrix.members.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u)),
  }));
  const anyWeight = rows.some((r) => r.bp > 0);
  // Sans coefficient, le serveur partage à parts égales entre les personnes.
  const amounts = splitCents(
    totalCents.value,
    rows.map((r) => (anyWeight ? r.bp : r.users.length)),
  );
  return rows.map((r, i) => ({ ...r, amount: amounts[i] }));
});

const partyLabel = (party: { kind: string; name: string; userIds: string[] }) =>
  party.kind === 'member' && party.userIds[0] === auth.user?.id ? 'Toi' : party.name;

const autoIsUsable = computed(() =>
  [...autoWeights.value.values()].some((bp) => bp > 0),
);

/** Applique les coefficients du troupeau aux lignes de participants. */
function applyAutoWeights() {
  rows.value = rows.value.map((r) => {
    const bp = autoWeights.value.get(r.userId) ?? 0;
    return { ...r, selected: bp > 0, weight: Math.max(1, bp) };
  });
}

/** Somme saisie en mode EXACT, pour afficher ce qu'il reste à répartir. */
const exactSum = computed(() =>
  selectedRows.value.reduce((sum, r) => sum + parseAmountToCents(r.amount), 0),
);
const exactRemaining = computed(() => totalCents.value - exactSum.value);

/** Aperçu de la répartition (même règle que le backend, au centime près). */
const preview = computed<Record<string, number>>(() => {
  const result: Record<string, number> = {};
  const selected = selectedRows.value;
  if (!selected.length || totalCents.value <= 0) return result;

  if (splitMode.value === 'EXACT') {
    selected.forEach((r) => (result[r.userId] = parseAmountToCents(r.amount)));
    return result;
  }

  const weights = selected.map((r) => (splitMode.value === 'EQUAL' ? 1 : Math.max(1, r.weight)));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const floors = weights.map((w) => Math.floor((totalCents.value * w) / totalWeight));
  let leftover = totalCents.value - floors.reduce((a, b) => a + b, 0);
  const remainders = weights
    .map((w, i) => ({ i, rest: (totalCents.value * w) / totalWeight - floors[i] }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);

  let k = 0;
  while (leftover > 0) {
    floors[remainders[k % remainders.length].i] += 1;
    leftover -= 1;
    k += 1;
  }

  selected.forEach((r, i) => (result[r.userId] = floors[i]));
  return result;
});

function buildRows() {
  rows.value = (group.value?.members ?? []).map((m) => ({
    userId: m.user.id,
    name: m.user.id === auth.user?.id ? 'Toi' : m.user.name,
    emoji: m.user.emoji,
    color: m.user.color,
    photo: m.user.avatarUrl ?? null,
    selected: true,
    weight: 1,
    amount: '',
  }));
}

onMounted(async () => {
  try {
    if (!group.value) await store.openGroup(props.id);
    if (!store.coefficients || store.coefficients.groupId !== props.id) {
      await store.fetchCoefficients(props.id);
    }
    buildRows();
    applyAutoWeights();
    paidById.value = auth.user?.id ?? '';

    if (props.expenseId) {
      const expense = await expensesApi.get(props.id, props.expenseId);
      title.value = expense.title;
      amount.value = centsToInput(expense.amountCents);
      category.value = expense.category;
      paidById.value = expense.paidBy.id;
      date.value = toDateInput(expense.date);
      note.value = expense.note ?? '';
      splitMode.value = expense.splitMode;
      customized.value = expense.splitMode !== 'AUTO';

      const byUser = new Map(expense.shares.map((s) => [s.user.id, s]));
      rows.value = rows.value.map((r) => {
        const share = byUser.get(r.userId);
        return {
          ...r,
          selected: Boolean(share),
          weight: share?.weight ?? 1,
          amount: share ? centsToInput(share.amountCents) : '',
        };
      });
      if (!customized.value) applyAutoWeights();
    }
  } catch (e) {
    toast.error((e as Error).message);
    router.replace(`/groups/${props.id}`);
  }
});

// En mode automatique, changer de catégorie change les coefficients appliqués.
watch(category, () => {
  if (splitMode.value === 'AUTO') applyAutoWeights();
});

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Passage en personnalisé : on convertit les coefficients (en points de base)
 * en petites parts lisibles — 40/20/20/20 % devient 2 / 1 / 1 / 1 part.
 */
function customize() {
  const selected = rows.value.filter((r) => r.selected).map((r) => Math.max(1, r.weight));
  if (selected.length) {
    const divisor = selected.reduce((acc, w) => gcd(acc, w), selected[0]);
    let simplified = selected.map((w) => Math.round(w / divisor));

    // Si la simplification donne encore de gros nombres, on ramène le plus petit à 1 part.
    if (Math.max(...simplified) > 20) {
      const min = Math.min(...selected);
      simplified = selected.map((w) => Math.max(1, Math.round(w / min)));
    }

    let i = 0;
    rows.value = rows.value.map((r) =>
      r.selected ? { ...r, weight: Math.max(1, Math.min(99, simplified[i++])) } : { ...r, weight: 1 },
    );
  }

  customized.value = true;
  splitMode.value = 'SHARES';
}

function backToAuto() {
  customized.value = false;
  splitMode.value = 'AUTO';
  applyAutoWeights();
}

// Quand on passe en mode EXACT, on pré-remplit avec la répartition égale.
watch(splitMode, (mode) => {
  if (mode === 'EXACT') {
    rows.value = rows.value.map((r) => ({
      ...r,
      amount: r.selected ? centsToInput(preview.value[r.userId] ?? 0) : '',
    }));
  }
});

function toggle(row: ParticipantRow) {
  row.selected = !row.selected;
  if (!row.selected) row.amount = '';
}

function selectAll(value: boolean) {
  rows.value.forEach((r) => (r.selected = value));
}

async function submit() {
  error.value = '';

  if (totalCents.value <= 0) {
    error.value = 'Le montant doit être supérieur à 0.';
    return;
  }
  if (splitMode.value !== 'AUTO' && !selectedRows.value.length) {
    error.value = 'Sélectionne au moins une personne pour partager la dépense.';
    return;
  }
  if (splitMode.value === 'EXACT' && exactRemaining.value !== 0) {
    error.value = `Il reste ${formatMoney(exactRemaining.value, currency.value)} à répartir.`;
    return;
  }

  const participants: ExpenseParticipantPayload[] = selectedRows.value.map((r) => ({
    userId: r.userId,
    ...(splitMode.value === 'SHARES' ? { weight: Math.max(1, Math.round(r.weight)) } : {}),
    ...(splitMode.value === 'EXACT' ? { amountCents: parseAmountToCents(r.amount) } : {}),
  }));

  const payload = {
    title: title.value.trim(),
    amountCents: totalCents.value,
    category: category.value,
    paidById: paidById.value,
    date: new Date(date.value).toISOString(),
    note: note.value.trim() || undefined,
    splitMode: splitMode.value,
    // En automatique, le serveur applique lui-même les coefficients du troupeau.
    participants: splitMode.value === 'AUTO' ? undefined : participants,
  };

  saving.value = true;
  try {
    if (props.expenseId) {
      await store.editExpense(props.id, props.expenseId, payload);
      toast.success('Dépense modifiée');
    } else {
      await store.addExpense(props.id, payload);
      toast.success('Dépense ajoutée');
    }
    router.replace(`/groups/${props.id}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function destroy() {
  if (!props.expenseId) return;
  const ok = await confirm.ask({
    title: 'Supprimer cette dépense ?',
    message: 'Les soldes du troupeau seront recalculés.',
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    await store.deleteExpense(props.id, props.expenseId);
    toast.success('Dépense supprimée');
    router.replace(`/groups/${props.id}`);
  } catch (e) {
    toast.error((e as Error).message);
  }
}
</script>

<template>
  <main class="page">
    <AppHeader :title="isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'" back />

    <LoadingState v-if="!group" />

    <form v-else class="stack" @submit.prevent="submit">
      <section class="card amount-field">
        <label class="sr-only" for="amount">Montant</label>
        <input
          id="amount"
          v-model="amount"
          class="amount-input"
          inputmode="decimal"
          placeholder="0,00"
          autocomplete="off"
        />
        <span class="amount-currency">{{ currencySymbol }}</span>
      </section>

      <div class="field">
        <label class="label" for="title">Intitulé</label>
        <input
          id="title"
          v-model="title"
          class="input"
          placeholder="Courses de la semaine"
          required
          maxlength="80"
        />
      </div>

      <div class="field">
        <span class="label" id="cat-label">Catégorie</span>
        <div class="categories" role="radiogroup" aria-labelledby="cat-label">
          <button
            v-for="(meta, key) in CATEGORY_META"
            :key="key"
            type="button"
            role="radio"
            :aria-checked="category === key"
            class="category"
            :class="{ active: category === key }"
            @click="category = key"
          >
            <CategoryIcon :category="key" :size="36" />
            <span>{{ meta.label }}</span>
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label" id="payer-label">Payé par</span>
        <div class="scroller" role="radiogroup" aria-labelledby="payer-label">
          <button
            v-for="r in rows"
            :key="r.userId"
            type="button"
            role="radio"
            :aria-checked="paidById === r.userId"
            class="chip payer"
            :class="{ active: paidById === r.userId }"
            @click="paidById = r.userId"
          >
            <UnicornAvatar :emoji="r.emoji" :color="r.color" :photo="r.photo" :size="24" />
            {{ r.name }}
          </button>
        </div>
      </div>

      <div class="field">
        <label class="label" for="date">Date</label>
        <input id="date" v-model="date" class="input" type="date" />
      </div>

      <!-- Répartition automatique (par défaut) -->
      <section v-if="!customized">
        <div class="section-head">
          <h2 class="section-title">Répartition</h2>
          <span class="badge badge-accent"><Wand2 :size="12" :stroke-width="2" /> Automatique</span>
        </div>
        <div class="list">
          <div
            v-for="p in autoParties"
            :key="p.party.id"
            class="list-row compact"
            :class="{ off: autoIsUsable && p.bp === 0 }"
          >
            <PartyAvatar :members="p.users" :family="p.party.kind === 'family'" :size="32" />
            <span class="grow list-title truncate">{{ partyLabel(p.party) }}</span>
            <span class="faint num pct">{{ formatPercent(p.bp) }}</span>
            <span class="share num">{{ formatMoney(p.amount, currency) }}</span>
          </div>
        </div>
        <p class="hint explain">
          Selon les coefficients « {{ categoryMeta(category).label.toLowerCase() }} » du troupeau.
          <RouterLink :to="`/groups/${id}/coefficients`">Modifier les coefficients</RouterLink>
        </p>
        <p v-if="!autoIsUsable" class="alert alert-warning">
          Aucun coefficient pour cette catégorie : la dépense sera partagée à parts égales.
        </p>
        <button type="button" class="btn btn-secondary btn-sm customize" @click="customize">
          <Pencil :size="16" :stroke-width="1.75" /> Personnaliser pour cette dépense
        </button>
      </section>

      <!-- Répartition personnalisée -->
      <section v-else>
        <div class="section-head">
          <h2 class="section-title">Répartition personnalisée</h2>
          <div class="row tight">
            <button type="button" class="text-btn" @click="selectAll(true)">Tous</button>
            <button type="button" class="text-btn" @click="selectAll(false)">Aucun</button>
          </div>
        </div>

        <div class="segmented modes" role="tablist" aria-label="Mode de répartition">
          <button
            v-for="m in modes"
            :key="m.key"
            type="button"
            role="tab"
            :aria-selected="splitMode === m.key"
            :class="{ active: splitMode === m.key }"
            @click="splitMode = m.key"
          >
            {{ m.label }}
          </button>
        </div>

        <div class="list">
          <div v-for="r in rows" :key="r.userId" class="list-row compact" :class="{ off: !r.selected }">
            <button
              type="button"
              class="checkbox"
              role="checkbox"
              :aria-checked="r.selected"
              :aria-label="`Inclure ${r.name}`"
              @click="toggle(r)"
            >
              <Check v-if="r.selected" :size="14" :stroke-width="3" />
            </button>
            <UnicornAvatar :emoji="r.emoji" :color="r.color" :photo="r.photo" :size="32" />
            <span class="grow list-title truncate" @click="toggle(r)">{{ r.name }}</span>

            <template v-if="r.selected">
              <div v-if="splitMode === 'SHARES'" class="stepper">
                <button
                  type="button"
                  aria-label="Une part de moins"
                  @click="r.weight = Math.max(1, r.weight - 1)"
                >
                  <Minus :size="14" :stroke-width="2.25" />
                </button>
                <span class="num">{{ r.weight }}</span>
                <button
                  type="button"
                  aria-label="Une part de plus"
                  @click="r.weight = Math.min(99, r.weight + 1)"
                >
                  <Plus :size="14" :stroke-width="2.25" />
                </button>
              </div>

              <input
                v-if="splitMode === 'EXACT'"
                v-model="r.amount"
                class="input exact num"
                inputmode="decimal"
                placeholder="0,00"
                :aria-label="`Montant pour ${r.name}`"
              />
              <span v-else class="share num">{{ formatMoney(preview[r.userId] ?? 0, currency) }}</span>
            </template>
          </div>
        </div>

        <p
          v-if="splitMode === 'EXACT'"
          class="hint explain num"
          :class="exactRemaining === 0 ? 'positive' : 'negative'"
        >
          {{
            exactRemaining === 0
              ? 'Le montant est entièrement réparti.'
              : exactRemaining > 0
                ? `Reste ${formatMoney(exactRemaining, currency)} à répartir.`
                : `Dépassement de ${formatMoney(-exactRemaining, currency)}.`
          }}
        </p>

        <button type="button" class="btn btn-secondary btn-sm customize" @click="backToAuto">
          <Wand2 :size="16" :stroke-width="1.75" /> Revenir aux coefficients du troupeau
        </button>
      </section>

      <div class="field">
        <label class="label" for="note">Note <span class="faint">(facultatif)</span></label>
        <textarea id="note" v-model="note" class="textarea" maxlength="280" />
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <div class="stack-sm">
        <button class="btn btn-block" type="submit" :disabled="saving || !title.trim() || totalCents <= 0">
          {{ saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter la dépense' }}
        </button>
        <button v-if="isEdit" type="button" class="btn btn-danger btn-block" @click="destroy">
          <Trash2 :size="18" :stroke-width="1.75" /> Supprimer la dépense
        </button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.categories {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.375rem;
}

.category {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.125rem;
  border-radius: 10px;
  border: 1px solid transparent;
  background: none;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  min-width: 0;
}

.category span:last-child {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 359px) {
  .categories {
    grid-template-columns: repeat(4, 1fr);
  }
}

.category.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.payer {
  padding-left: 0.25rem;
}

.compact {
  min-height: 52px;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.off {
  opacity: 0.45;
}

.pct {
  min-width: 3.5rem;
  text-align: right;
}

.share {
  font-weight: 600;
  min-width: 5rem;
  text-align: right;
}

.explain {
  margin: 0.5rem 0.25rem 0;
}

.customize {
  margin-top: 0.75rem;
}

.modes {
  margin-bottom: 0.75rem;
}

.tight {
  gap: 0.25rem;
}

.checkbox {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1.5px solid var(--border-strong);
  background: var(--surface);
  color: var(--on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
}

.checkbox[aria-checked='true'] {
  background: var(--accent);
  border-color: var(--accent);
}

.stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.stepper button {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--surface);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.stepper button:hover {
  background: var(--surface-2);
}

.stepper span {
  min-width: 2rem;
  text-align: center;
  font-weight: 600;
  font-size: var(--fs-sm);
}

.exact {
  width: 6.5rem;
  min-height: 38px;
  padding: 0.375rem 0.625rem;
  text-align: right;
}
</style>

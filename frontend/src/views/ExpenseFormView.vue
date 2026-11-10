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
  toDateInput,
} from '@/utils/format';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import LoadingUnicorn from '@/components/LoadingUnicorn.vue';

const props = defineProps<{ id: string; expenseId?: string }>();

const auth = useAuthStore();
const store = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

interface ParticipantRow {
  userId: string;
  name: string;
  emoji: string;
  color: string;
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

const group = computed(() => store.current);
const currency = computed(() => group.value?.currency ?? 'EUR');
const totalCents = computed(() => parseAmountToCents(amount.value));
const selectedRows = computed(() => rows.value.filter((r) => r.selected));

/** Coefficients du troupeau pour la catégorie choisie (points de base). */
const autoWeights = computed<Map<string, number>>(() => {
  const entry = store.coefficients?.categories.find((c) => c.category === category.value);
  return new Map((entry?.shares ?? []).map((s) => [s.userId, s.shareBp]));
});

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
    selected: true,
    weight: 1,
    amount: '',
  }));
}

onMounted(async () => {
  try {
    if (!group.value || group.value.id !== props.id) await store.openGroup(props.id);
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
    error.value = 'Le montant doit être supérieur à 0';
    return;
  }
  if (splitMode.value !== 'AUTO' && !selectedRows.value.length) {
    error.value = 'Sélectionne au moins une licorne pour partager la dépense';
    return;
  }
  if (splitMode.value === 'EXACT' && exactRemaining.value !== 0) {
    error.value = `Il reste ${formatMoney(exactRemaining.value, currency.value)} à répartir`;
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
      toast.success('Dépense mise à jour ✨');
    } else {
      await store.addExpense(props.id, payload);
      toast.success('Dépense ajoutée ✨');
    }
    router.replace(`/groups/${props.id}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function destroy() {
  if (!props.expenseId || !confirm('Supprimer cette dépense ?')) return;
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

    <LoadingUnicorn v-if="!group" />

    <form v-else class="stack" @submit.prevent="submit">
      <section class="card amount-card">
        <input
          v-model="amount"
          class="amount-input"
          inputmode="decimal"
          placeholder="0,00"
          aria-label="Montant"
        />
        <p class="muted center">{{ currency === 'EUR' ? '€' : currency }}</p>
      </section>

      <div class="field">
        <label class="label" for="title">Intitulé</label>
        <input
          id="title"
          v-model="title"
          class="input"
          placeholder="Crêpes au caramel"
          required
          maxlength="80"
        />
      </div>

      <div class="field">
        <span class="label">Catégorie</span>
        <div class="scroller">
          <button
            v-for="(meta, key) in CATEGORY_META"
            :key="key"
            type="button"
            class="chip"
            :class="{ active: category === key }"
            @click="category = key"
          >
            {{ meta.emoji }} {{ meta.label }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">Payé par</span>
        <div class="scroller">
          <button
            v-for="r in rows"
            :key="r.userId"
            type="button"
            class="payer"
            :class="{ selected: paidById === r.userId }"
            @click="paidById = r.userId"
          >
            <UnicornAvatar :emoji="r.emoji" :color="r.color" :size="34" />
            <span>{{ r.name }}</span>
          </button>
        </div>
      </div>

      <div class="field">
        <label class="label" for="date">Date</label>
        <input id="date" v-model="date" class="input" type="date" />
      </div>

      <!-- ---------- Répartition automatique (par défaut) ---------- -->
      <section v-if="!customized" class="card">
        <div class="between">
          <h2>Répartition</h2>
          <span class="pill pill-positive">🪄 Automatique</span>
        </div>

        <p class="muted auto-hint">
          Selon les coefficients du troupeau pour
          <strong>{{ categoryMeta(category).label.toLowerCase() }}</strong> —
          <RouterLink :to="`/groups/${id}/coefficients`">régler les coefficients</RouterLink>
        </p>

        <div class="divider" />

        <div v-for="r in rows" :key="r.userId" class="participant" :class="{ off: !r.selected }">
          <UnicornAvatar :emoji="r.emoji" :color="r.color" :size="36" :ring="r.selected" />
          <span class="grow truncate">{{ r.name }}</span>
          <span class="coeff">{{ formatPercent(autoWeights.get(r.userId) ?? 0) }}</span>
          <span class="share">{{ formatMoney(preview[r.userId] ?? 0, currency) }}</span>
        </div>

        <p v-if="!autoIsUsable" class="hint negative">
          Aucun coefficient pour cette catégorie : la dépense sera partagée à parts égales.
        </p>

        <div class="divider" />

        <button type="button" class="btn btn-sm btn-ghost btn-block" @click="customize">
          ✏️ Personnaliser pour cette dépense
        </button>
      </section>

      <!-- ---------- Répartition personnalisée ---------- -->
      <section v-else class="card">
        <div class="between">
          <h2>Partagé entre</h2>
          <div class="row">
            <button type="button" class="faint link" @click="selectAll(true)">Tous</button>
            <button type="button" class="faint link" @click="selectAll(false)">Aucun</button>
          </div>
        </div>

        <div class="scroller modes">
          <button
            type="button"
            class="chip"
            :class="{ active: splitMode === 'EQUAL' }"
            @click="splitMode = 'EQUAL'"
          >
            ⚖️ Parts égales
          </button>
          <button
            type="button"
            class="chip"
            :class="{ active: splitMode === 'SHARES' }"
            @click="splitMode = 'SHARES'"
          >
            🧮 Par parts
          </button>
          <button
            type="button"
            class="chip"
            :class="{ active: splitMode === 'EXACT' }"
            @click="splitMode = 'EXACT'"
          >
            ✍️ Montants exacts
          </button>
        </div>

        <div class="divider" />

        <div v-for="r in rows" :key="r.userId" class="participant" :class="{ off: !r.selected }">
          <button type="button" class="check" @click="toggle(r)">
            <UnicornAvatar :emoji="r.emoji" :color="r.color" :size="36" :ring="r.selected" />
          </button>
          <span class="grow truncate" @click="toggle(r)">{{ r.name }}</span>

          <template v-if="r.selected">
            <div v-if="splitMode === 'SHARES'" class="weight">
              <button type="button" class="step" @click="r.weight = Math.max(1, r.weight - 1)">
                −
              </button>
              <span>{{ r.weight }}</span>
              <button type="button" class="step" @click="r.weight = Math.min(99, r.weight + 1)">
                ＋
              </button>
            </div>

            <input
              v-if="splitMode === 'EXACT'"
              v-model="r.amount"
              class="input exact"
              inputmode="decimal"
              placeholder="0,00"
            />

            <span v-else class="share">{{ formatMoney(preview[r.userId] ?? 0, currency) }}</span>
          </template>
        </div>

        <p v-if="splitMode === 'EXACT'" class="center" :class="exactRemaining === 0 ? 'positive' : 'negative'">
          {{
            exactRemaining === 0
              ? 'Tout est réparti ✨'
              : `Reste ${formatMoney(exactRemaining, currency)}`
          }}
        </p>

        <div class="divider" />

        <button type="button" class="btn btn-sm btn-ghost btn-block" @click="backToAuto">
          🪄 Revenir aux coefficients du troupeau
        </button>
      </section>

      <div class="field">
        <label class="label" for="note">Note (optionnel)</label>
        <textarea id="note" v-model="note" class="textarea" maxlength="280" />
      </div>

      <p v-if="error" class="error-box">{{ error }}</p>

      <button class="btn btn-block" type="submit" :disabled="saving">
        {{ saving ? 'Enregistrement…' : isEdit ? 'Enregistrer ✨' : 'Ajouter la dépense ✨' }}
      </button>

      <button v-if="isEdit" type="button" class="btn btn-danger btn-block" @click="destroy">
        🗑️ Supprimer
      </button>
    </form>
  </main>
</template>

<style scoped>
.amount-card {
  padding: 1.4rem 1rem 1rem;
}

.payer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius);
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.7);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--ink-soft);
  cursor: pointer;
  flex-shrink: 0;
}

.payer.selected {
  border-color: var(--lilas);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}

.modes {
  margin-top: 0.6rem;
}

.participant {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.42rem 0;
  transition: opacity 0.18s ease;
  font-size: 0.94rem;
  font-weight: 600;
}

.participant.off {
  opacity: 0.38;
}

.check {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.share {
  font-weight: 700;
  color: var(--ink-soft);
  font-size: 0.9rem;
  min-width: 68px;
  text-align: right;
}

.coeff {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--lilas);
  background: var(--lilas-soft);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
}

.auto-hint {
  margin-top: 0.3rem;
  line-height: 1.45;
}

.hint {
  font-size: 0.82rem;
  font-weight: 600;
  text-align: center;
  margin-top: 0.6rem;
}

.weight {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
}

.step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  color: var(--lilas);
  font-weight: 700;
  cursor: pointer;
}

.exact {
  width: 96px;
  padding: 0.5rem 0.6rem;
  text-align: right;
  font-size: 0.9rem;
}

.link {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: 700;
  color: var(--lilas);
}
</style>

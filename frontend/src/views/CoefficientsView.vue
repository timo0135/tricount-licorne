<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import type { CategoryCoefficients } from '@/api/types';
import {
  CATEGORY_META,
  TOTAL_BP,
  bpToInput,
  categoryMeta,
  formatMoney,
  formatPercent,
  parseInputToBp,
} from '@/utils/format';
import { CircleAlert, Copy, Equal, RefreshCw, Wand2 } from 'lucide-vue-next';
import { useConfirmStore } from '@/stores/confirm';
import AppHeader from '@/components/AppHeader.vue';
import PartyAvatar from '@/components/PartyAvatar.vue';
import CategoryIcon from '@/components/CategoryIcon.vue';
import LoadingState from '@/components/LoadingState.vue';

const props = defineProps<{ id: string }>();

const store = useGroupsStore();
const toast = useToastStore();
const confirm = useConfirmStore();
const router = useRouter();

/** État local : catégorie → userId → saisie en pourcentage. */
const draft = ref<Record<string, Record<string, string>>>({});
const active = ref('logement');
const saving = ref(false);
const applying = ref(false);
const error = ref('');
const ready = ref(false);

const matrix = computed(() => store.coefficients);
/** Lignes de la matrice : une par entité (famille ou membre seul). */
const members = computed(() => matrix.value?.parties ?? []);
const usersOf = (party: { userIds: string[] }) =>
  party.userIds
    .map((id) => matrix.value?.members.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
const categories = computed(() => Object.keys(CATEGORY_META));
const currency = computed(() => store.current?.currency ?? 'EUR');

/** Total de la catégorie affichée, en points de base. */
const totalBp = (category: string) =>
  members.value.reduce((sum, m) => sum + parseInputToBp(draft.value[category]?.[m.id] ?? '0'), 0);

const activeTotal = computed(() => totalBp(active.value));
const isBalanced = computed(() => activeTotal.value === TOTAL_BP);

/** Catégories dont le total ne fait pas 100 % : impossible d'enregistrer. */
const brokenCategories = computed(() => categories.value.filter((c) => totalBp(c) !== TOTAL_BP));

/** Une catégorie est « personnalisée » si tout le monde n'a pas la même part. */
const isCustom = (category: string) => {
  const values = members.value.map((m) => parseInputToBp(draft.value[category]?.[m.id] ?? '0'));
  return values.some((v) => Math.abs(v - values[0]) > 1);
};

/** Ce que représente le coefficient sur une dépense d'exemple de 100 €. */
const exampleCents = 10_000;
const exampleFor = (userId: string) =>
  Math.round((exampleCents * parseInputToBp(draft.value[active.value]?.[userId] ?? '0')) / TOTAL_BP);

onMounted(async () => {
  try {
    if (!store.current || store.current.id !== props.id) await store.openGroup(props.id);
    const data = await store.fetchCoefficients(props.id);

    const next: Record<string, Record<string, string>> = {};
    for (const entry of data.categories) {
      next[entry.category] = Object.fromEntries(
        entry.shares.map((s) => [s.partyId, bpToInput(s.shareBp)]),
      );
    }
    draft.value = next;
    ready.value = true;
  } catch (e) {
    toast.error((e as Error).message);
    router.replace(`/groups/${props.id}`);
  }
});

function setEqual(category: string) {
  const ids = members.value.map((m) => m.id);
  const base = Math.floor(TOTAL_BP / ids.length);
  let leftover = TOTAL_BP - base * ids.length;
  const values: Record<string, string> = {};
  ids.forEach((id) => {
    const extra = leftover > 0 ? 1 : 0;
    leftover -= extra;
    values[id] = bpToInput(base + extra);
  });
  draft.value = { ...draft.value, [category]: values };
}

/** Ajuste la dernière licorne pour que le total retombe pile sur 100 %. */
function autoAdjust(category: string) {
  const ids = members.value.map((m) => m.id);
  if (!ids.length) return;
  const others = ids.slice(0, -1);
  const used = others.reduce((sum, id) => sum + parseInputToBp(draft.value[category]?.[id] ?? '0'), 0);
  const last = ids[ids.length - 1];
  draft.value[category] = {
    ...draft.value[category],
    [last]: bpToInput(Math.max(0, TOTAL_BP - used)),
  };
}

function copyToAll() {
  const source = draft.value[active.value];
  const next = { ...draft.value };
  for (const category of categories.value) next[category] = { ...source };
  draft.value = next;
  toast.success('Répartition copiée sur toutes les catégories');
}

async function save() {
  error.value = '';
  if (brokenCategories.value.length) {
    error.value = `Total ≠ 100 % pour : ${brokenCategories.value
      .map((c) => categoryMeta(c).label)
      .join(', ')}`;
    return;
  }

  const payload: CategoryCoefficients[] = categories.value.map((category) => ({
    category,
    shares: members.value.map((m) => ({
      partyId: m.id,
      shareBp: parseInputToBp(draft.value[category]?.[m.id] ?? '0'),
    })),
  }));

  saving.value = true;
  try {
    await store.saveCoefficients(props.id, payload);
    toast.success('Coefficients enregistrés');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function applyToExisting() {
  const ok = await confirm.ask({
    title: 'Recalculer les dépenses existantes ?',
    message:
      'Les dépenses en répartition automatique seront recalculées avec les coefficients actuels. Les répartitions personnalisées ne changent pas.',
    confirmLabel: 'Recalculer',
  });
  if (!ok) return;
  applying.value = true;
  try {
    const res = await store.applyCoefficients(props.id);
    toast.success(
      res.updated ? `${res.updated} dépense(s) recalculée(s)` : 'Aucune dépense à recalculer',
    );
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <main class="page page-medium">
    <AppHeader
      title="Coefficients"
      subtitle="La part de chacun, par catégorie"
      :back="`/groups/${id}?tab=members`"
    />

    <LoadingState v-if="!ready" />

    <div v-else class="stack">
      <p class="alert alert-info">
        Chaque dépense est répartie selon ces pourcentages. Un coefficient de 0 % exclut la
        personne de la catégorie. Une famille a un seul coefficient, partagé à parts égales
        entre ses membres.
      </p>

      <div class="scroller" role="tablist" aria-label="Catégories">
        <button
          v-for="c in categories"
          :key="c"
          role="tab"
          :aria-selected="active === c"
          class="chip"
          :class="{ active: active === c }"
          @click="active = c"
        >
          {{ categoryMeta(c).label }}
          <span v-if="totalBp(c) !== TOTAL_BP" class="dot dot-error" aria-label="total incorrect" />
          <span v-else-if="isCustom(c)" class="dot" aria-label="personnalisée" />
        </button>
      </div>

      <section class="list">
        <div class="list-row head">
          <CategoryIcon :category="active" :size="36" />
          <h2 class="grow">{{ categoryMeta(active).label }}</h2>
          <span class="badge num" :class="isBalanced ? 'badge-positive' : 'badge-negative'">
            Total {{ formatPercent(activeTotal) }}
          </span>
        </div>

        <div v-for="m in members" :key="m.id" class="list-row">
          <PartyAvatar :members="usersOf(m)" :family="m.kind === 'family'" :size="36" />
          <div class="grow">
            <p class="list-title truncate">{{ m.name }}</p>
            <p class="list-sub num truncate">
              <template v-if="m.kind === 'family'">{{ m.userIds.length }} membres · </template>sur
              100 € : {{ formatMoney(exampleFor(m.id), currency) }}
            </p>
          </div>
          <div class="pct">
            <input
              v-model="draft[active][m.id]"
              class="input pct-input num"
              inputmode="decimal"
              :aria-label="`Pourcentage de ${m.name} pour ${categoryMeta(active).label}`"
            />
            <span class="sign">%</span>
          </div>
        </div>
      </section>

      <div class="actions">
        <button class="btn btn-secondary btn-sm" @click="setEqual(active)">
          <Equal :size="16" :stroke-width="1.75" /> Égaliser
        </button>
        <button class="btn btn-secondary btn-sm" @click="autoAdjust(active)">
          <Wand2 :size="16" :stroke-width="1.75" /> Ajuster à 100 %
        </button>
        <button class="btn btn-secondary btn-sm" @click="copyToAll">
          <Copy :size="16" :stroke-width="1.75" /> Copier partout
        </button>
      </div>

      <p v-if="!isBalanced" class="alert alert-warning num">
        Le total doit faire exactement 100 % (actuellement {{ formatPercent(activeTotal) }}).
      </p>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <div class="stack-sm">
        <button class="btn btn-block" :disabled="saving || brokenCategories.length > 0" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer les coefficients' }}
        </button>
        <button class="btn btn-secondary btn-block" :disabled="applying" @click="applyToExisting">
          <RefreshCw :size="16" :stroke-width="1.75" />
          {{ applying ? 'Recalcul…' : 'Recalculer les dépenses existantes' }}
        </button>
      </div>

      <p class="hint center">
        Les dépenses déjà saisies gardent leur répartition, sauf si tu lances le recalcul.
      </p>
    </div>
  </main>
</template>

<style scoped>
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-block;
}

.dot-error {
  background: var(--negative);
}

.head h2 {
  font-size: var(--fs-base);
}

.pct {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.pct-input {
  width: 4.75rem;
  min-height: 40px;
  padding: 0.375rem 0.625rem;
  text-align: right;
  font-weight: 600;
}

.sign {
  color: var(--text-3);
  font-size: var(--fs-sm);
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.actions .btn {
  padding: 0.5rem;
  min-height: 44px;
  font-size: var(--fs-xs);
  white-space: normal;
  line-height: 1.2;
  text-align: center;
}
</style>

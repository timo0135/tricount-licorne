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
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import LoadingUnicorn from '@/components/LoadingUnicorn.vue';

const props = defineProps<{ id: string }>();

const store = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

/** État local : catégorie → userId → saisie en pourcentage. */
const draft = ref<Record<string, Record<string, string>>>({});
const active = ref('logement');
const saving = ref(false);
const applying = ref(false);
const error = ref('');
const ready = ref(false);

const matrix = computed(() => store.coefficients);
const members = computed(() => matrix.value?.members ?? []);
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
        entry.shares.map((s) => [s.userId, bpToInput(s.shareBp)]),
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
  toast.success('Répartition copiée sur toutes les catégories ✨');
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
      userId: m.id,
      shareBp: parseInputToBp(draft.value[category]?.[m.id] ?? '0'),
    })),
  }));

  saving.value = true;
  try {
    await store.saveCoefficients(props.id, payload);
    toast.success('Coefficients enregistrés ✨');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function applyToExisting() {
  if (!confirm('Recalculer les dépenses déjà saisies en mode automatique ?')) return;
  applying.value = true;
  try {
    const res = await store.applyCoefficients(props.id);
    toast.success(
      res.updated ? `${res.updated} dépense(s) recalculée(s) ✨` : 'Aucune dépense à recalculer',
    );
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <main class="page">
    <AppHeader title="Coefficients" subtitle="Qui paie quelle part, par thème" back />

    <LoadingUnicorn v-if="!ready" />

    <template v-else>
      <section class="card intro">
        <p class="muted">
          Chaque dépense est répartie automatiquement selon ces pourcentages. Un coefficient à
          <strong>0 %</strong> exclut la licorne de la catégorie.
        </p>
      </section>

      <div class="scroller cats">
        <button
          v-for="c in categories"
          :key="c"
          class="chip"
          :class="{ active: active === c }"
          @click="active = c"
        >
          {{ categoryMeta(c).emoji }} {{ categoryMeta(c).label }}
          <span v-if="isCustom(c)" class="dot" :class="{ 'dot-on': active === c }" />
        </button>
      </div>

      <section class="card">
        <div class="between">
          <h2>{{ categoryMeta(active).emoji }} {{ categoryMeta(active).label }}</h2>
          <span class="pill" :class="isBalanced ? 'pill-positive' : 'pill-negative'">
            {{ formatPercent(activeTotal) }}
          </span>
        </div>

        <div class="divider" />

        <div v-for="m in members" :key="m.id" class="member">
          <UnicornAvatar :emoji="m.emoji" :color="m.color" :size="38" />
          <div class="grow">
            <p class="name truncate">{{ m.name }}</p>
            <p class="faint">sur 100 € : {{ formatMoney(exampleFor(m.id), currency) }}</p>
          </div>
          <div class="pct">
            <input
              v-model="draft[active][m.id]"
              class="input pct-input"
              inputmode="decimal"
              aria-label="Pourcentage"
            />
            <span class="sign">%</span>
          </div>
        </div>

        <div class="divider" />

        <div class="actions">
          <button class="btn btn-sm btn-ghost" @click="setEqual(active)">⚖️ Égaliser</button>
          <button class="btn btn-sm btn-ghost" @click="autoAdjust(active)">🪄 Ajuster à 100 %</button>
          <button class="btn btn-sm btn-ghost" @click="copyToAll">📋 Copier partout</button>
        </div>

        <p v-if="!isBalanced" class="hint negative">
          Le total doit faire exactement 100 % (actuellement {{ formatPercent(activeTotal) }}).
        </p>
      </section>

      <p v-if="error" class="error-box">{{ error }}</p>

      <button class="btn btn-block" :disabled="saving || brokenCategories.length > 0" @click="save">
        {{ saving ? 'Enregistrement…' : 'Enregistrer les coefficients ✨' }}
      </button>

      <button class="btn btn-ghost btn-block apply" :disabled="applying" @click="applyToExisting">
        {{ applying ? 'Recalcul…' : '🔄 Recalculer les dépenses existantes' }}
      </button>

      <p class="faint center note">
        Les dépenses déjà enregistrées gardent leur répartition d'origine, sauf si tu lances le
        recalcul. Les licornes exclues d'une dépense précise le restent.
      </p>
    </template>
  </main>
</template>

<style scoped>
.intro {
  margin-bottom: 0.8rem;
}

.cats {
  margin-bottom: 0.8rem;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lilas);
  display: inline-block;
}

.dot-on {
  background: #fff;
}

.member {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.45rem 0;
}

.name {
  font-weight: 700;
  font-size: 0.94rem;
}

.pct {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pct-input {
  width: 78px;
  padding: 0.5rem 0.55rem;
  text-align: right;
  font-weight: 700;
  font-size: 0.92rem;
}

.sign {
  font-weight: 700;
  color: var(--ink-soft);
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.actions .btn {
  flex: 1;
  white-space: nowrap;
  padding-left: 0.6rem;
  padding-right: 0.6rem;
}

.hint {
  margin-top: 0.7rem;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: center;
}

.apply {
  margin-top: 0.7rem;
}

.note {
  margin-top: 0.8rem;
  line-height: 1.5;
}
</style>

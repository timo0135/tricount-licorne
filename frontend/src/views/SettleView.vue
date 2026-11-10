<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useBackTo } from '@/utils/navigation';
import { useRoute, useRouter } from 'vue-router';
import { ArrowDownUp, CircleAlert } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { centsToInput, formatMoney, parseAmountToCents } from '@/utils/format';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import LoadingState from '@/components/LoadingState.vue';

const props = defineProps<{ id: string }>();

const auth = useAuthStore();
const store = useGroupsStore();
const toast = useToastStore();
const router = useRouter();
const backTo = useBackTo();
const route = useRoute();

const fromUserId = ref('');
const toUserId = ref('');
const amount = ref('');
const note = ref('');
const saving = ref(false);
const error = ref('');

const group = computed(() => store.current?.id === props.id ? store.current : null);
const currency = computed(() => group.value?.currency ?? 'EUR');
const currencySymbol = computed(() => (currency.value === 'EUR' ? '€' : currency.value));
const members = computed(() => group.value?.members ?? []);
const meId = computed(() => auth.user?.id ?? '');
const userOf = (id: string) => members.value.find((m) => m.user.id === id)?.user;
const nameOf = (id: string) => (id === meId.value ? 'Toi' : (userOf(id)?.name ?? '—'));
const cents = computed(() => parseAmountToCents(amount.value));
const familyName = (familyId: string | null) =>
  group.value?.families.find((f) => f.id === familyId)?.name;
/** « Alice (toi) · Famille Martin » : le remboursement compte pour toute la famille. */
const optionLabel = (m: { familyId: string | null; user: { id: string; name: string } }) => {
  const base = m.user.id === meId.value ? `${m.user.name} (toi)` : m.user.name;
  const family = familyName(m.familyId);
  return family ? `${base} · ${family}` : base;
};

function swap() {
  [fromUserId.value, toUserId.value] = [toUserId.value, fromUserId.value];
}

onMounted(async () => {
  try {
    if (!group.value) await store.openGroup(props.id);
    fromUserId.value = (route.query.from as string) ?? meId.value;
    toUserId.value =
      (route.query.to as string) ??
      members.value.find((m) => m.user.id !== fromUserId.value)?.user.id ??
      '';
    if (route.query.amount) amount.value = centsToInput(Number(route.query.amount));
  } catch (e) {
    toast.error((e as Error).message);
    router.replace(`/groups/${props.id}`);
  }
});

async function submit() {
  error.value = '';
  if (fromUserId.value === toUserId.value) {
    error.value = 'Choisis deux personnes différentes.';
    return;
  }
  if (cents.value <= 0) {
    error.value = 'Le montant doit être supérieur à 0.';
    return;
  }

  saving.value = true;
  try {
    await store.addSettlement(props.id, {
      fromUserId: fromUserId.value,
      toUserId: toUserId.value,
      amountCents: cents.value,
      note: note.value.trim() || undefined,
    });
    toast.success('Remboursement enregistré');
    backTo(`/groups/${props.id}?tab=balances`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="page">
    <AppHeader title="Remboursement" :back="`/groups/${id}?tab=balances`" />

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

      <section class="card parties">
        <div class="field">
          <label class="label" for="from">De</label>
          <div class="party">
            <UnicornAvatar
              :emoji="userOf(fromUserId)?.emoji"
              :color="userOf(fromUserId)?.color"
              :photo="userOf(fromUserId)?.avatarUrl"
              :size="36"
            />
            <select id="from" v-model="fromUserId" class="select">
              <option v-for="m in members" :key="m.id" :value="m.user.id">
                {{ optionLabel(m) }}
              </option>
            </select>
          </div>
        </div>

        <div class="swap-row">
          <span class="line" />
          <button type="button" class="icon-btn bordered" aria-label="Inverser" @click="swap">
            <ArrowDownUp :size="18" :stroke-width="1.75" />
          </button>
          <span class="line" />
        </div>

        <div class="field">
          <label class="label" for="to">À</label>
          <div class="party">
            <UnicornAvatar
              :emoji="userOf(toUserId)?.emoji"
              :color="userOf(toUserId)?.color"
              :photo="userOf(toUserId)?.avatarUrl"
              :size="36"
            />
            <select id="to" v-model="toUserId" class="select">
              <option v-for="m in members" :key="m.id" :value="m.user.id">
                {{ optionLabel(m) }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <p v-if="fromUserId && toUserId && fromUserId !== toUserId && cents > 0" class="summary muted">
        {{ nameOf(fromUserId) }} rembourse
        <strong class="num">{{ formatMoney(cents, currency) }}</strong> à {{ nameOf(toUserId) }}.
      </p>

      <div class="field">
        <label class="label" for="note">Note <span class="faint">(facultatif)</span></label>
        <input id="note" v-model="note" class="input" placeholder="Virement du 12 novembre" maxlength="140" />
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <button class="btn btn-block" type="submit" :disabled="saving">
        {{ saving ? 'Enregistrement…' : 'Enregistrer le remboursement' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.party {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.swap-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.75rem 0;
}

.line {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.summary {
  text-align: center;
  font-size: var(--fs-base);
}

.summary strong {
  color: var(--text);
  font-weight: 600;
}
</style>

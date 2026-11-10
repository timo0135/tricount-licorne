<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { centsToInput, formatMoney, parseAmountToCents } from '@/utils/format';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import LoadingUnicorn from '@/components/LoadingUnicorn.vue';

const props = defineProps<{ id: string }>();

const auth = useAuthStore();
const store = useGroupsStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();

const fromUserId = ref('');
const toUserId = ref('');
const amount = ref('');
const note = ref('');
const saving = ref(false);
const error = ref('');

const group = computed(() => store.current);
const currency = computed(() => group.value?.currency ?? 'EUR');
const members = computed(() => group.value?.members ?? []);

const swap = () => {
  const tmp = fromUserId.value;
  fromUserId.value = toUserId.value;
  toUserId.value = tmp;
};

onMounted(async () => {
  try {
    if (!group.value || group.value.id !== props.id) await store.openGroup(props.id);

    fromUserId.value = (route.query.from as string) ?? auth.user?.id ?? '';
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
  const cents = parseAmountToCents(amount.value);

  if (fromUserId.value === toUserId.value) {
    error.value = 'Choisis deux licornes différentes';
    return;
  }
  if (cents <= 0) {
    error.value = 'Le montant doit être supérieur à 0';
    return;
  }

  saving.value = true;
  try {
    await store.addSettlement(props.id, {
      fromUserId: fromUserId.value,
      toUserId: toUserId.value,
      amountCents: cents,
      note: note.value.trim() || undefined,
    });
    toast.success('Remboursement enregistré 💸');
    router.replace(`/groups/${props.id}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="page">
    <AppHeader title="Enregistrer un remboursement" back />

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

      <section class="card stack">
        <div class="field">
          <label class="label" for="from">Qui rembourse</label>
          <select id="from" v-model="fromUserId" class="select">
            <option v-for="m in members" :key="m.id" :value="m.user.id">
              {{ m.user.emoji }} {{ m.user.name }}
            </option>
          </select>
        </div>

        <div class="center">
          <button type="button" class="icon-btn" aria-label="Inverser" @click="swap">🔄</button>
        </div>

        <div class="field">
          <label class="label" for="to">Qui reçoit</label>
          <select id="to" v-model="toUserId" class="select">
            <option v-for="m in members" :key="m.id" :value="m.user.id">
              {{ m.user.emoji }} {{ m.user.name }}
            </option>
          </select>
        </div>
      </section>

      <div class="preview card" v-if="fromUserId && toUserId && fromUserId !== toUserId">
        <UnicornAvatar
          :emoji="members.find((m) => m.user.id === fromUserId)?.user.emoji"
          :color="members.find((m) => m.user.id === fromUserId)?.user.color"
          :size="42"
        />
        <span class="arrow">→ {{ formatMoney(parseAmountToCents(amount), currency) }} →</span>
        <UnicornAvatar
          :emoji="members.find((m) => m.user.id === toUserId)?.user.emoji"
          :color="members.find((m) => m.user.id === toUserId)?.user.color"
          :size="42"
        />
      </div>

      <div class="field">
        <label class="label" for="note">Note (optionnel)</label>
        <input id="note" v-model="note" class="input" placeholder="Virement du 12 août" maxlength="140" />
      </div>

      <p v-if="error" class="error-box">{{ error }}</p>

      <button class="btn btn-block" type="submit" :disabled="saving">
        {{ saving ? 'Enregistrement…' : 'Enregistrer 💸' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.amount-card {
  padding: 1.4rem 1rem 1rem;
}

.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
}

.arrow {
  font-weight: 700;
  color: var(--ink-soft);
  font-size: 0.92rem;
}
</style>

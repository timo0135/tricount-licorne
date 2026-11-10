<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useBackTo } from '@/utils/navigation';
import { useRouter } from 'vue-router';
import { Check, CircleAlert, Trash2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { useConfirmStore } from '@/stores/confirm';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';
import PartyAvatar from '@/components/PartyAvatar.vue';
import LoadingState from '@/components/LoadingState.vue';

const props = defineProps<{ id: string; familyId?: string }>();

const auth = useAuthStore();
const store = useGroupsStore();
const toast = useToastStore();
const confirm = useConfirmStore();
const router = useRouter();
const backTo = useBackTo();

const group = computed(() => (store.current?.id === props.id ? store.current : null));
const family = computed(() => group.value?.families.find((f) => f.id === props.familyId));
const isEdit = computed(() => Boolean(props.familyId));

const name = ref('');
const selected = ref<Set<string>>(new Set());
const saving = ref(false);
const error = ref('');

const members = computed(() => group.value?.members ?? []);
const selectedUsers = computed(() =>
  members.value.filter((m) => selected.value.has(m.user.id)).map((m) => m.user),
);
const otherFamily = (familyId: string | null) =>
  familyId && familyId !== props.familyId
    ? group.value?.families.find((f) => f.id === familyId)?.name
    : undefined;

onMounted(async () => {
  try {
    if (!group.value) await store.openGroup(props.id);
    if (isEdit.value) {
      if (!family.value) throw new Error('Famille introuvable.');
      name.value = family.value.name;
      selected.value = new Set(
        members.value.filter((m) => m.familyId === props.familyId).map((m) => m.user.id),
      );
    } else if (auth.user && !members.value.find((m) => m.user.id === auth.user!.id)?.familyId) {
      // Par défaut, on propose de créer sa propre famille.
      selected.value = new Set([auth.user.id]);
    }
  } catch (e) {
    toast.error((e as Error).message);
    router.replace(`/groups/${props.id}?tab=members`);
  }
});

function toggle(userId: string) {
  const next = new Set(selected.value);
  if (next.has(userId)) next.delete(userId);
  else next.add(userId);
  selected.value = next;
}

async function save() {
  error.value = '';
  if (!selected.value.size) {
    error.value = 'Choisis au moins un membre.';
    return;
  }
  saving.value = true;
  try {
    const body = { name: name.value.trim(), memberIds: [...selected.value] };
    if (isEdit.value) await store.updateFamily(props.id, props.familyId!, body);
    else await store.createFamily(props.id, body);
    toast.success(isEdit.value ? 'Famille enregistrée' : 'Famille créée');
    backTo(`/groups/${props.id}?tab=members`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

async function dissolve() {
  const ok = await confirm.ask({
    title: `Dissoudre « ${family.value?.name} » ?`,
    message:
      'Chaque membre redevient une entité à part : il garde sa part du coefficient de la famille, et les soldes sont recalculés par personne.',
    confirmLabel: 'Dissoudre',
    danger: true,
  });
  if (!ok) return;
  try {
    await store.deleteFamily(props.id, props.familyId!);
    toast.success('Famille dissoute');
    backTo(`/groups/${props.id}?tab=members`);
  } catch (e) {
    toast.error((e as Error).message);
  }
}
</script>

<template>
  <main class="page">
    <AppHeader :title="isEdit ? 'Modifier la famille' : 'Nouvelle famille'" :back="`/groups/${id}?tab=members`" />

    <LoadingState v-if="!group" />

    <form v-else class="stack" @submit.prevent="save">
      <div class="card preview">
        <PartyAvatar :members="selectedUsers" family :size="44" />
        <div class="grow">
          <p class="list-title truncate">{{ name || 'Nom de la famille' }}</p>
          <p class="list-sub truncate">
            {{ selectedUsers.length ? selectedUsers.map((u) => u.name).join(', ') : 'Aucun membre' }}
          </p>
        </div>
      </div>

      <p class="alert alert-info">
        Une famille compte pour une seule entité : un coefficient commun (réparti à parts égales
        entre ses membres), un solde commun et des remboursements communs.
      </p>

      <div class="field">
        <label class="label" for="name">Nom</label>
        <input id="name" v-model="name" class="input" placeholder="Famille Martin" required maxlength="40" />
      </div>

      <div>
        <h2 class="section-title">Membres</h2>
        <div class="list">
          <button
            v-for="m in members"
            :key="m.id"
            type="button"
            class="list-row"
            role="checkbox"
            :aria-checked="selected.has(m.user.id)"
            @click="toggle(m.user.id)"
          >
            <span class="checkbox" :class="{ on: selected.has(m.user.id) }" aria-hidden="true">
              <Check v-if="selected.has(m.user.id)" :size="14" :stroke-width="3" />
            </span>
            <UnicornAvatar
              :emoji="m.user.emoji"
              :color="m.user.color"
              :photo="m.user.avatarUrl"
              :size="32"
            />
            <div class="grow">
              <p class="list-title truncate">
                {{ m.user.name }}<span v-if="m.user.id === auth.user?.id" class="faint"> (toi)</span>
              </p>
              <p v-if="otherFamily(m.familyId)" class="list-sub truncate">
                {{ selected.has(m.user.id) ? 'Quittera' : 'Dans' }} « {{ otherFamily(m.familyId) }} »
              </p>
            </div>
          </button>
        </div>
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <div class="stack-sm">
        <button class="btn btn-block" type="submit" :disabled="saving || !name.trim() || !selected.size">
          {{ saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la famille' }}
        </button>
        <button v-if="isEdit" type="button" class="btn btn-danger btn-block" @click="dissolve">
          <Trash2 :size="18" :stroke-width="1.75" /> Dissoudre la famille
        </button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
}

.checkbox.on {
  background: var(--accent);
  border-color: var(--accent);
}
</style>

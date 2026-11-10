<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useBackTo } from '@/utils/navigation';
import { useRouter } from 'vue-router';
import { Check, CircleAlert, Trash2 } from 'lucide-vue-next';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { GROUP_EMOJIS, GROUP_TINTS } from '@/utils/format';
import { checkImage, prepareImage } from '@/utils/image';
import AppHeader from '@/components/AppHeader.vue';
import GroupAvatar from '@/components/GroupAvatar.vue';
import GroupBanner from '@/components/GroupBanner.vue';
import ImagePickerButton from '@/components/ImagePickerButton.vue';
import LoadingState from '@/components/LoadingState.vue';

const props = defineProps<{ id: string }>();

const store = useGroupsStore();
const toast = useToastStore();
const router = useRouter();
const backTo = useBackTo();

const group = computed(() => (store.current?.id === props.id ? store.current : null));
const name = ref('');
const description = ref('');
const emoji = ref('🦄');
const tint = ref('aurora');
const saving = ref(false);
const error = ref('');
const busy = reactive({ photo: false, banner: false });

function fill() {
  if (!group.value) return;
  name.value = group.value.name;
  description.value = group.value.description ?? '';
  emoji.value = group.value.emoji;
  tint.value = group.value.gradient;
}

onMounted(async () => {
  try {
    if (!group.value) await store.openGroup(props.id);
    fill();
  } catch (e) {
    toast.error((e as Error).message);
    router.replace('/');
  }
});

async function upload(kind: 'photo' | 'banner', file: File) {
  const problem = checkImage(file);
  if (problem) return toast.error(problem);
  busy[kind] = true;
  try {
    await store.setGroupImage(props.id, kind, await prepareImage(file));
    toast.success(kind === 'photo' ? 'Photo du troupeau mise à jour' : 'Bannière mise à jour');
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    busy[kind] = false;
  }
}

async function removeImage(kind: 'photo' | 'banner') {
  busy[kind] = true;
  try {
    await store.removeGroupImage(props.id, kind);
    toast.success(kind === 'photo' ? 'Photo retirée' : 'Bannière retirée');
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    busy[kind] = false;
  }
}

async function save() {
  error.value = '';
  saving.value = true;
  try {
    await store.updateGroup(props.id, {
      name: name.value.trim(),
      description: description.value.trim() || null,
      emoji: emoji.value,
      gradient: tint.value,
    });
    toast.success('Troupeau enregistré');
    backTo(`/groups/${props.id}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="page">
    <AppHeader title="Réglages du troupeau" :back="`/groups/${id}`" />

    <LoadingState v-if="!group" />

    <div v-else class="stack">
      <section class="card appearance">
        <GroupBanner :url="group.bannerUrl" :tint="tint" />
        <div class="appearance-body">
          <GroupAvatar
            class="avatar"
            :emoji="emoji"
            :tint="tint"
            :photo="group.photoUrl"
            :size="64"
            ring
          />
          <div class="image-actions">
            <p class="label">Bannière</p>
            <div class="row wrap">
              <ImagePickerButton
                :label="group.bannerUrl ? 'Changer' : 'Ajouter une bannière'"
                :busy="busy.banner"
                @select="(f) => upload('banner', f)"
              />
              <button
                v-if="group.bannerUrl"
                class="btn btn-sm btn-ghost"
                :disabled="busy.banner"
                @click="removeImage('banner')"
              >
                <Trash2 :size="16" :stroke-width="1.75" /> Retirer
              </button>
            </div>
            <p class="label">Photo du troupeau</p>
            <div class="row wrap">
              <ImagePickerButton
                :label="group.photoUrl ? 'Changer' : 'Ajouter une photo'"
                :busy="busy.photo"
                @select="(f) => upload('photo', f)"
              />
              <button
                v-if="group.photoUrl"
                class="btn btn-sm btn-ghost"
                :disabled="busy.photo"
                @click="removeImage('photo')"
              >
                <Trash2 :size="16" :stroke-width="1.75" /> Retirer
              </button>
            </div>
            <p class="hint">
              La bannière est recadrée au format 3:1, la photo en carré. JPEG, PNG, WebP ou GIF.
            </p>
          </div>
        </div>
      </section>

      <form class="stack" @submit.prevent="save">
        <div class="field">
          <label class="label" for="name">Nom</label>
          <input id="name" v-model="name" class="input" required maxlength="60" />
        </div>

        <div class="field">
          <label class="label" for="desc">Description <span class="faint">(facultatif)</span></label>
          <textarea id="desc" v-model="description" class="textarea" maxlength="280" />
        </div>

        <div class="field">
          <span id="emoji-label" class="label">Icône <span class="faint">(sans photo)</span></span>
          <div class="scroller" role="radiogroup" aria-labelledby="emoji-label">
            <button
              v-for="e in GROUP_EMOJIS"
              :key="e"
              type="button"
              role="radio"
              :aria-checked="emoji === e"
              class="emoji-option"
              :class="{ active: emoji === e }"
              @click="emoji = e"
            >
              {{ e }}
            </button>
          </div>
        </div>

        <div class="field">
          <span id="tint-label" class="label">Couleur</span>
          <div class="tints" role="radiogroup" aria-labelledby="tint-label">
            <button
              v-for="(t, key) in GROUP_TINTS"
              :key="key"
              type="button"
              role="radio"
              :aria-checked="tint === key"
              :aria-label="t.label"
              class="tint"
              :style="{ background: t.color }"
              @click="tint = key"
            >
              <Check v-if="tint === key" :size="18" :stroke-width="2.5" color="#fff" />
            </button>
          </div>
        </div>

        <p v-if="error" class="alert alert-error" role="alert">
          <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
        </p>

        <button class="btn btn-block" type="submit" :disabled="saving || !name.trim()">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.appearance {
  padding: 0;
  overflow: hidden;
}

.appearance-body {
  padding: 0 1rem 1rem;
}

.avatar {
  margin-top: -32px;
  position: relative;
}

.image-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.image-actions .label + .row {
  margin-bottom: 0.25rem;
}

.wrap {
  flex-wrap: wrap;
  gap: 0.5rem;
}

.emoji-option {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-size: 1.25rem;
  cursor: pointer;
}

.emoji-option.active {
  border: 2px solid var(--accent);
  background: var(--accent-soft);
}

.tints {
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.tint {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tint[aria-checked='true'] {
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 4px var(--text);
}
</style>

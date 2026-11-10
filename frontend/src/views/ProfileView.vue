<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Check, LogOut } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { useConfirmStore } from '@/stores/confirm';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';

const auth = useAuthStore();
const groups = useGroupsStore();
const toast = useToastStore();
const confirm = useConfirmStore();
const router = useRouter();

const EMOJIS = ['🦄', '🌈', '✨', '🍭', '🌸', '⭐', '🧁', '🪄', '☁️', '🫧', '🍬', '💜'];
const COLORS = ['#f7a8c4', '#c9a7f5', '#a7e8d8', '#ffd59e', '#a9cbf5', '#f5b8e8', '#bdf5a7', '#ffc7c7'];

const name = ref(auth.user?.name ?? '');
const emoji = ref(auth.user?.emoji ?? '🦄');
const color = ref((auth.user?.color ?? '#c9a7f5').toLowerCase());
const saving = ref(false);

async function save() {
  saving.value = true;
  try {
    await auth.updateProfile({ name: name.value.trim(), emoji: emoji.value, color: color.value });
    toast.success('Profil enregistré');
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}

async function logout() {
  const ok = await confirm.ask({ title: 'Se déconnecter ?', confirmLabel: 'Se déconnecter' });
  if (!ok) return;
  await auth.logout();
  groups.reset();
  router.replace('/login');
}
</script>

<template>
  <main class="page">
    <AppHeader title="Profil" back />

    <section class="identity">
      <UnicornAvatar :emoji="emoji" :color="color" :size="72" />
      <div class="grow">
        <h2 class="truncate">{{ name || 'Sans nom' }}</h2>
        <p class="muted truncate">{{ auth.user?.email }}</p>
      </div>
    </section>

    <form class="stack" @submit.prevent="save">
      <div class="field">
        <label class="label" for="name">Prénom</label>
        <input id="name" v-model="name" class="input" minlength="2" maxlength="40" required />
      </div>

      <div class="field">
        <span class="label" id="avatar-label">Avatar</span>
        <div class="emojis" role="radiogroup" aria-labelledby="avatar-label">
          <button
            v-for="e in EMOJIS"
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
        <span class="label" id="color-label">Couleur</span>
        <div class="colors" role="radiogroup" aria-labelledby="color-label">
          <button
            v-for="c in COLORS"
            :key="c"
            type="button"
            role="radio"
            :aria-checked="color === c"
            :aria-label="`Couleur ${c}`"
            class="color"
            :style="{ background: c }"
            @click="color = c"
          >
            <Check v-if="color === c" :size="18" :stroke-width="2.5" color="#1c1917" />
          </button>
        </div>
      </div>

      <button class="btn btn-block" type="submit" :disabled="saving || name.trim().length < 2">
        {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </form>

    <div class="divider spaced" />

    <button class="btn btn-danger btn-block" @click="logout">
      <LogOut :size="18" :stroke-width="1.75" /> Se déconnecter
    </button>
  </main>
</template>

<style scoped>
.identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.emojis {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
}

.emoji-option {
  aspect-ratio: 1;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-size: 1.375rem;
  cursor: pointer;
}

.emoji-option.active {
  border: 2px solid var(--accent);
  background: var(--accent-soft);
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.color {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.color[aria-checked='true'] {
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 4px var(--text);
}

.spaced {
  margin: 1.5rem 0;
}
</style>

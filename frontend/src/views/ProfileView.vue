<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import AppHeader from '@/components/AppHeader.vue';
import UnicornAvatar from '@/components/UnicornAvatar.vue';

const auth = useAuthStore();
const groups = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

const EMOJIS = ['🦄', '🌈', '✨', '🍭', '🌸', '⭐️', '🧁', '🪄', '☁️', '🫧', '🍬', '💜'];
const COLORS = [
  '#F7A8C4',
  '#C9A7F5',
  '#A7E8D8',
  '#FFD59E',
  '#A9CBF5',
  '#F5B8E8',
  '#BDF5A7',
  '#FFC7C7',
];

const name = ref(auth.user?.name ?? '');
const emoji = ref(auth.user?.emoji ?? '🦄');
const color = ref(auth.user?.color ?? '#C9A7F5');
const saving = ref(false);

async function save() {
  saving.value = true;
  try {
    await auth.updateProfile({ name: name.value, emoji: emoji.value, color: color.value });
    toast.success('Profil mis à jour ✨');
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}

function logout() {
  auth.logout();
  groups.reset();
  router.replace('/login');
}
</script>

<template>
  <main class="page">
    <AppHeader title="Mon profil" back />

    <section class="card center stack">
      <div class="center">
        <UnicornAvatar :emoji="emoji" :color="color" :size="86" ring />
      </div>
      <h2>{{ name || 'Licorne anonyme' }}</h2>
      <p class="muted">{{ auth.user?.email }}</p>
    </section>

    <form class="stack form" @submit.prevent="save">
      <div class="field">
        <label class="label" for="name">Prénom</label>
        <input id="name" v-model="name" class="input" minlength="2" maxlength="40" required />
      </div>

      <div class="field">
        <span class="label">Mon emoji</span>
        <div class="scroller">
          <button
            v-for="e in EMOJIS"
            :key="e"
            type="button"
            class="chip"
            :class="{ active: emoji === e }"
            @click="emoji = e"
          >
            {{ e }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">Ma couleur</span>
        <div class="scroller">
          <button
            v-for="c in COLORS"
            :key="c"
            type="button"
            class="dot"
            :class="{ selected: color === c }"
            :style="{ background: c }"
            :aria-label="c"
            @click="color = c"
          />
        </div>
      </div>

      <button class="btn btn-block" type="submit" :disabled="saving">
        {{ saving ? 'Enregistrement…' : 'Enregistrer ✨' }}
      </button>
    </form>

    <button class="btn btn-ghost btn-block logout" @click="logout">👋 Se déconnecter</button>
  </main>
</template>

<style scoped>
.form {
  margin-top: 1rem;
}

.dot {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.dot.selected {
  border-color: #fff;
  box-shadow: 0 0 0 3px var(--lilas);
}

.logout {
  margin-top: 1rem;
}
</style>

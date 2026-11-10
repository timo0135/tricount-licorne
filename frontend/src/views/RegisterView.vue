<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { CircleAlert } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import AuthShell from '@/components/AuthShell.vue';

const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');

const passwordOk = computed(() => password.value.length >= 8);
const canSubmit = computed(() => name.value.trim().length >= 2 && email.value && passwordOk.value);

async function submit() {
  error.value = '';
  try {
    await auth.register(name.value.trim(), email.value.trim(), password.value);
    toast.success(`Bienvenue, ${name.value.trim()}`);
    router.push('/');
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <AuthShell title="Créer un compte" subtitle="Un avatar licorne t'est attribué, tu pourras le changer ensuite.">
    <form class="stack" novalidate @submit.prevent="submit">
      <div class="field">
        <label class="label" for="name">Prénom</label>
        <input id="name" v-model="name" class="input" autocomplete="given-name" required minlength="2" />
      </div>

      <div class="field">
        <label class="label" for="email">Adresse e-mail</label>
        <input
          id="email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
          inputmode="email"
          required
        />
      </div>

      <div class="field">
        <label class="label" for="password">Mot de passe</label>
        <input
          id="password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="new-password"
          aria-describedby="password-hint"
          required
          minlength="8"
        />
        <p id="password-hint" class="hint" :class="{ positive: passwordOk }">8 caractères minimum</p>
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <button class="btn btn-block" type="submit" :disabled="auth.loading || !canSubmit">
        {{ auth.loading ? 'Création…' : 'Créer mon compte' }}
      </button>
    </form>

    <template #footer>
      Déjà inscrit ? <RouterLink to="/login">Se connecter</RouterLink>
    </template>
  </AuthShell>
</template>

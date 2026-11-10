<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CircleAlert } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import AuthShell from '@/components/AuthShell.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');

async function submit() {
  error.value = '';
  try {
    await auth.login(email.value.trim(), password.value);
    router.push((route.query.redirect as string) ?? '/');
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <AuthShell title="Connexion" subtitle="Partagez les dépenses du groupe, selon la part de chacun.">
    <form class="stack" novalidate @submit.prevent="submit">
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
          autocomplete="current-password"
          required
        />
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <button class="btn btn-block" type="submit" :disabled="auth.loading || !email || !password">
        {{ auth.loading ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>

    <template #footer>
      Pas encore de compte ? <RouterLink to="/register">Créer un compte</RouterLink>
    </template>
  </AuthShell>
</template>

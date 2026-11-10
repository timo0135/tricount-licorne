<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');

async function submit() {
  error.value = '';
  try {
    await auth.login(email.value, password.value);
    router.push((route.query.redirect as string) ?? '/');
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <main class="page auth">
    <div class="hero">
      <span class="unicorn float">🦄</span>
      <h1>Licorne Tricount</h1>
      <p class="muted">Partagez vos dépenses, gardez la magie</p>
    </div>

    <form class="card stack" @submit.prevent="submit">
      <div class="field">
        <label class="label" for="email">Email</label>
        <input
          id="email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
          placeholder="sophie@licorne.fr"
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
          placeholder="••••••••"
          required
        />
      </div>

      <p v-if="error" class="error-box">{{ error }}</p>

      <button class="btn btn-block" type="submit" :disabled="auth.loading">
        {{ auth.loading ? 'Un instant…' : 'Entrer dans la prairie ✨' }}
      </button>
    </form>

    <p class="center muted signup">
      Pas encore de compte ?
      <RouterLink to="/register">Créer ma licorne</RouterLink>
    </p>
  </main>
</template>

<style scoped>
.auth {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100dvh;
  gap: 1.4rem;
}

.hero {
  text-align: center;
}

.unicorn {
  font-size: 4.2rem;
  display: block;
}

.hero h1 {
  margin-top: 0.4rem;
  background: var(--gradient-main);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 2rem;
}

.signup {
  margin-top: -0.4rem;
}
</style>

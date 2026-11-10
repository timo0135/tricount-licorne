<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';

const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');

async function submit() {
  error.value = '';
  try {
    await auth.register(name.value, email.value, password.value);
    toast.success(`Bienvenue ${name.value} ! ${auth.user?.emoji ?? '🦄'}`);
    router.push('/');
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <main class="page auth">
    <div class="hero">
      <span class="unicorn float">✨</span>
      <h1>Créer ma licorne</h1>
      <p class="muted">Un emoji et une couleur te seront attribués au hasard</p>
    </div>

    <form class="card stack" @submit.prevent="submit">
      <div class="field">
        <label class="label" for="name">Prénom</label>
        <input id="name" v-model="name" class="input" placeholder="Sophie" required minlength="2" />
      </div>

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
          autocomplete="new-password"
          placeholder="8 caractères minimum"
          required
          minlength="8"
        />
      </div>

      <p v-if="error" class="error-box">{{ error }}</p>

      <button class="btn btn-block" type="submit" :disabled="auth.loading">
        {{ auth.loading ? 'Un instant…' : 'Rejoindre la prairie 🌈' }}
      </button>
    </form>

    <p class="center muted">
      Déjà une licorne ?
      <RouterLink to="/login">Se connecter</RouterLink>
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
  font-size: 3.6rem;
  display: block;
}

.hero h1 {
  margin-top: 0.4rem;
  background: var(--gradient-main);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
</style>

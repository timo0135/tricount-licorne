<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CircleAlert, ShieldCheck } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import AuthShell from '@/components/AuthShell.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const code = ref('');
const useRecovery = ref(false);
const step = ref<'password' | 'code'>('password');
const error = ref('');
const codeInput = ref<HTMLInputElement | null>(null);

const done = () => router.push((route.query.redirect as string) ?? '/');

async function submit() {
  error.value = '';
  try {
    const result = await auth.login(email.value.trim(), password.value);
    if (result === 'two-factor') {
      step.value = 'code';
      password.value = '';
      await nextTick();
      codeInput.value?.focus();
      return;
    }
    done();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function submitCode() {
  error.value = '';
  try {
    await auth.verifyTwoFactor(code.value.trim());
    done();
  } catch (e) {
    error.value = (e as Error).message;
    code.value = '';
    // Jeton d'étape expiré : retour au mot de passe.
    if (/reconnecte-toi|expirée/i.test(error.value)) back();
  }
}

/** Saisie automatique : le code est envoyé dès le 6e chiffre. */
function onCodeInput() {
  if (!useRecovery.value) code.value = code.value.replace(/\D/g, '').slice(0, 6);
  if (!useRecovery.value && code.value.length === 6 && !auth.loading) submitCode();
}

function back() {
  auth.cancelTwoFactor();
  step.value = 'password';
  code.value = '';
  useRecovery.value = false;
}
</script>

<template>
  <AuthShell
    v-if="step === 'password'"
    title="Connexion"
    subtitle="Partagez les dépenses du groupe, selon la part de chacun."
  >
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

  <AuthShell
    v-else
    title="Vérification"
    :subtitle="
      useRecovery
        ? 'Saisis un de tes codes de secours. Chaque code ne fonctionne qu’une fois.'
        : 'Saisis le code à 6 chiffres affiché dans ton application d’authentification.'
    "
  >
    <form class="stack" novalidate @submit.prevent="submitCode">
      <div class="field">
        <label class="label" for="code">
          {{ useRecovery ? 'Code de secours' : 'Code de vérification' }}
        </label>
        <input
          id="code"
          ref="codeInput"
          v-model="code"
          class="input code"
          :class="{ digits: !useRecovery }"
          :inputmode="useRecovery ? 'text' : 'numeric'"
          :autocomplete="useRecovery ? 'off' : 'one-time-code'"
          :maxlength="useRecovery ? 16 : 6"
          :placeholder="useRecovery ? 'xxxx-xxxx' : '000000'"
          autocapitalize="off"
          spellcheck="false"
          required
          @input="onCodeInput"
        />
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <button class="btn btn-block" type="submit" :disabled="auth.loading || code.trim().length < 6">
        <ShieldCheck :size="18" :stroke-width="2" />
        {{ auth.loading ? 'Vérification…' : 'Valider' }}
      </button>

      <div class="between">
        <button type="button" class="text-btn" @click="back">Retour</button>
        <button
          type="button"
          class="text-btn"
          @click="
            useRecovery = !useRecovery;
            code = '';
            error = '';
          "
        >
          {{ useRecovery ? 'Utiliser l’application' : 'Utiliser un code de secours' }}
        </button>
      </div>
    </form>
  </AuthShell>
</template>

<style scoped>
.code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 1.25rem;
  text-align: center;
  letter-spacing: 0.15em;
}

.code.digits {
  letter-spacing: 0.5em;
  font-size: 1.5rem;
}
</style>

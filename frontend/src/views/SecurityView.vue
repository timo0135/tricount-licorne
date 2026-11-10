<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import {
  CircleAlert,
  Cloud,
  Copy,
  Download,
  Fingerprint,
  KeyRound,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from 'lucide-vue-next';
import { passkeysApi, twoFactorApi } from '@/api';
import type { Passkey, TwoFactorSetup, TwoFactorStatus } from '@/api/types';
import { createPasskey, passkeyErrorMessage, passkeysSupported } from '@/utils/passkeys';
import { useConfirmStore } from '@/stores/confirm';
import { formatDate } from '@/utils/format';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import AppHeader from '@/components/AppHeader.vue';
import LoadingState from '@/components/LoadingState.vue';

const auth = useAuthStore();
const toast = useToastStore();
const confirm = useConfirmStore();

// ---------- Passkeys ----------
const canUsePasskey = passkeysSupported();
const passkeys = ref<Passkey[] | null>(null);
const addingPasskey = ref(false);

async function loadPasskeys() {
  passkeys.value = await passkeysApi.list();
}

async function addPasskey() {
  addingPasskey.value = true;
  try {
    const created = await createPasskey();
    await loadPasskeys();
    toast.success(`Passkey ajoutée : ${created.name}`);
  } catch (e) {
    const message = passkeyErrorMessage(e);
    if (message) toast.error(message);
  } finally {
    addingPasskey.value = false;
  }
}

async function removePasskey(passkey: Passkey) {
  const ok = await confirm.ask({
    title: `Supprimer la passkey « ${passkey.name} » ?`,
    message:
      'Cet appareil ne pourra plus te connecter avec Face ID ou Touch ID. Pense aussi à la supprimer du trousseau de l’appareil.',
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    await passkeysApi.remove(passkey.id);
    await loadPasskeys();
    toast.success('Passkey supprimée');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

type Step = 'status' | 'setup' | 'codes' | 'disable' | 'regenerate';
const step = ref<Step>('status');
const status = ref<TwoFactorStatus | null>(null);
const setup = ref<TwoFactorSetup | null>(null);
const recoveryCodes = ref<string[]>([]);
const code = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');
const codeInput = ref<HTMLInputElement | null>(null);

const enabled = computed(() => status.value?.enabled ?? false);

async function loadStatus() {
  status.value = await twoFactorApi.status();
  auth.setTwoFactorEnabled(status.value.enabled);
}

onMounted(() =>
  Promise.all([loadStatus(), loadPasskeys()]).catch((e) => toast.error((e as Error).message)),
);

function reset(next: Step) {
  step.value = next;
  code.value = '';
  password.value = '';
  error.value = '';
  nextTick(() => codeInput.value?.focus());
}

async function run(task: () => Promise<void>) {
  error.value = '';
  busy.value = true;
  try {
    await task();
  } catch (e) {
    error.value = (e as Error).message;
    code.value = '';
  } finally {
    busy.value = false;
  }
}

const startSetup = () =>
  run(async () => {
    setup.value = await twoFactorApi.setup();
    reset('setup');
  });

const confirmSetup = () =>
  run(async () => {
    const res = await twoFactorApi.enable(code.value.trim());
    recoveryCodes.value = res.recoveryCodes;
    await loadStatus();
    setup.value = null;
    reset('codes');
    toast.success('Double authentification activée');
  });

const disable = () =>
  run(async () => {
    await twoFactorApi.disable(password.value, code.value.trim());
    await loadStatus();
    reset('status');
    toast.success('Double authentification désactivée');
  });

const regenerate = () =>
  run(async () => {
    const res = await twoFactorApi.regenerateRecoveryCodes(code.value.trim());
    recoveryCodes.value = res.recoveryCodes;
    await loadStatus();
    reset('codes');
  });

function onlyDigits() {
  code.value = code.value.replace(/\D/g, '').slice(0, 6);
}

async function copy(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error('Copie impossible : sélectionne le texte pour le copier.');
  }
}

function downloadCodes() {
  const text = [
    'Licorne Tricount — codes de secours',
    `Compte : ${auth.user?.email ?? ''}`,
    'Chaque code ne fonctionne qu’une fois.',
    '',
    ...recoveryCodes.value,
    '',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'licorne-tricount-codes-de-secours.txt';
  link.click();
  URL.revokeObjectURL(url);
}

function finishCodes() {
  recoveryCodes.value = [];
  reset('status');
}
</script>

<template>
  <main class="page">
    <AppHeader title="Sécurité" back="/profile" />

    <LoadingState v-if="!status" />

    <!-- État -->
    <div v-else-if="step === 'status'" class="stack">
      <section>
        <h2 class="section-title">Passkeys</h2>
        <p class="muted explain section-intro">
          Connecte-toi avec Face ID, Touch ID ou le code de ton appareil, sans mot de passe. Une
          passkey vaut à elle seule une double authentification.
        </p>
        <div v-if="passkeys?.length" class="list">
          <div v-for="p in passkeys" :key="p.id" class="list-row">
            <Fingerprint :size="20" :stroke-width="1.75" class="faint" />
            <div class="grow">
              <p class="list-title truncate">{{ p.name }}</p>
              <p class="list-sub truncate">
                Ajoutée le {{ formatDate(p.createdAt) }}
                <template v-if="p.lastUsedAt"> · utilisée le {{ formatDate(p.lastUsedAt) }}</template>
              </p>
            </div>
            <span v-if="p.backedUp" class="badge" title="Synchronisée sur tes autres appareils">
              <Cloud :size="12" :stroke-width="2" /> Synchronisée
            </span>
            <button class="icon-btn" :aria-label="`Supprimer ${p.name}`" @click="removePasskey(p)">
              <Trash2 :size="18" :stroke-width="1.75" />
            </button>
          </div>
        </div>
        <button
          v-if="canUsePasskey"
          class="btn btn-secondary btn-block add-passkey"
          :disabled="addingPasskey"
          @click="addPasskey"
        >
          <Fingerprint :size="18" :stroke-width="1.75" />
          {{ addingPasskey ? 'En attente de l’appareil…' : 'Ajouter une passkey sur cet appareil' }}
        </button>
        <p v-else class="alert alert-info">Ce navigateur ne prend pas en charge les passkeys.</p>
      </section>

      <h2 class="section-title">Codes à usage unique</h2>
      <section class="card state">
        <span class="tile" :class="{ on: enabled }">
          <component :is="enabled ? ShieldCheck : ShieldOff" :size="22" :stroke-width="1.75" />
        </span>
        <div class="grow">
          <h2>Double authentification</h2>
          <p class="muted">
            {{
              enabled
                ? 'Activée : un code de ton application est demandé à chaque connexion.'
                : 'Désactivée : ton mot de passe suffit pour te connecter.'
            }}
          </p>
        </div>
      </section>

      <template v-if="!enabled">
        <p class="muted explain">
          Après ton mot de passe, l’application te demandera un code à 6 chiffres généré par une
          application d’authentification : Mots de passe d’iPhone, Google Authenticator, 1Password,
          Bitwarden…
        </p>
        <button class="btn btn-block" :disabled="busy" @click="startSetup">
          <ShieldCheck :size="18" :stroke-width="2" /> Activer la double authentification
        </button>
      </template>

      <template v-else>
        <div class="list">
          <div class="list-row">
            <KeyRound :size="20" :stroke-width="1.75" class="faint" />
            <div class="grow">
              <p class="list-title">Codes de secours</p>
              <p class="list-sub num">
                {{ status.remainingRecoveryCodes }} code{{ status.remainingRecoveryCodes > 1 ? 's' : '' }}
                disponible{{ status.remainingRecoveryCodes > 1 ? 's' : '' }}
              </p>
            </div>
            <button class="btn btn-sm btn-secondary" @click="reset('regenerate')">Renouveler</button>
          </div>
        </div>
        <p v-if="status.remainingRecoveryCodes <= 3" class="alert alert-warning">
          Il te reste peu de codes de secours : pense à les renouveler.
        </p>
        <button class="btn btn-danger btn-block" @click="reset('disable')">
          <ShieldOff :size="18" :stroke-width="1.75" /> Désactiver
        </button>
      </template>
      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>
    </div>

    <!-- Activation : QR code puis premier code -->
    <form v-else-if="step === 'setup' && setup" class="stack" @submit.prevent="confirmSetup">
      <ol class="steps">
        <li>
          <p class="list-title">Scanne ce QR code</p>
          <p class="muted">Avec ton application d’authentification (ou l’appareil photo de l’iPhone).</p>
          <div class="qr"><img :src="setup.qrCode" width="200" height="200" alt="QR code de configuration" /></div>
          <p class="muted small">Impossible de scanner ? Saisis cette clé dans l’application :</p>
          <div class="secret">
            <code class="num">{{ setup.secret }}</code>
            <button
              type="button"
              class="icon-btn bordered"
              aria-label="Copier la clé"
              @click="copy(setup.secret.replace(/\s/g, ''), 'Clé copiée')"
            >
              <Copy :size="16" :stroke-width="1.75" />
            </button>
          </div>
          <a :href="setup.otpauthUrl" class="mobile-only open-app">
            <Smartphone :size="16" :stroke-width="1.75" /> Ouvrir dans une application de ce téléphone
          </a>
        </li>
        <li>
          <label class="list-title" for="setup-code">Saisis le code affiché</label>
          <input
            id="setup-code"
            ref="codeInput"
            v-model="code"
            class="input code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            required
            @input="onlyDigits"
          />
        </li>
      </ol>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <div class="stack-sm">
        <button class="btn btn-block" type="submit" :disabled="busy || code.length !== 6">
          {{ busy ? 'Vérification…' : 'Activer' }}
        </button>
        <button type="button" class="btn btn-ghost btn-block" @click="reset('status')">Annuler</button>
      </div>
    </form>

    <!-- Codes de secours, affichés une seule fois -->
    <div v-else-if="step === 'codes'" class="stack">
      <p class="alert alert-warning">
        Note ces codes maintenant : ils ne seront plus jamais affichés. Chacun permet de te
        connecter une fois si tu perds ton téléphone.
      </p>
      <ul class="codes card num" aria-label="Codes de secours">
        <li v-for="c in recoveryCodes" :key="c">{{ c }}</li>
      </ul>
      <div class="row actions">
        <button class="btn btn-secondary grow" @click="copy(recoveryCodes.join('\n'), 'Codes copiés')">
          <Copy :size="16" :stroke-width="1.75" /> Copier
        </button>
        <button class="btn btn-secondary grow" @click="downloadCodes">
          <Download :size="16" :stroke-width="1.75" /> Télécharger
        </button>
      </div>
      <button class="btn btn-block" @click="finishCodes">J’ai noté mes codes</button>
    </div>

    <!-- Désactivation ou renouvellement des codes -->
    <form
      v-else
      class="stack"
      @submit.prevent="step === 'disable' ? disable() : regenerate()"
    >
      <p class="muted">
        {{
          step === 'disable'
            ? 'Pour désactiver la double authentification, confirme avec ton mot de passe et un code.'
            : 'Les anciens codes de secours ne fonctionneront plus. Confirme avec un code de ton application.'
        }}
      </p>
      <div v-if="step === 'disable'" class="field">
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
      <div class="field">
        <label class="label" for="confirm-code">
          {{ step === 'disable' ? 'Code de l’application ou code de secours' : 'Code de l’application' }}
        </label>
        <input
          id="confirm-code"
          ref="codeInput"
          v-model="code"
          class="input code"
          :inputmode="step === 'disable' ? 'text' : 'numeric'"
          autocomplete="one-time-code"
          :maxlength="step === 'disable' ? 16 : 6"
          autocapitalize="off"
          spellcheck="false"
          required
        />
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <div class="stack-sm">
        <button
          class="btn btn-block"
          :class="{ 'btn-danger-solid': step === 'disable' }"
          type="submit"
          :disabled="busy || code.trim().length < 6 || (step === 'disable' && !password)"
        >
          {{ step === 'disable' ? 'Désactiver' : 'Générer de nouveaux codes' }}
        </button>
        <button type="button" class="btn btn-ghost btn-block" @click="reset('status')">Annuler</button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.state {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
}

.state h2 {
  font-size: var(--fs-base);
}

.state p {
  margin-top: 0.125rem;
}

.tile {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  color: var(--text-2);
  flex-shrink: 0;
}

.tile.on {
  background: var(--positive-soft);
  color: var(--positive);
}

.explain {
  line-height: 1.5;
}

.section-intro {
  margin: 0 0.25rem 0.75rem;
}

.add-passkey {
  margin-top: 0.75rem;
}

.steps {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.steps li > * + * {
  margin-top: 0.375rem;
}

.qr {
  display: inline-flex;
  padding: 0.75rem;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin: 0.5rem 0;
}

.qr img {
  display: block;
  image-rendering: pixelated;
}

.small {
  font-size: var(--fs-xs);
}

.secret {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.secret code {
  flex: 1;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: var(--fs-sm);
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  user-select: all;
  word-break: break-all;
}

.open-app {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 40px;
  font-size: var(--fs-sm);
}

.code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 1.25rem;
  letter-spacing: 0.3em;
  text-align: center;
  margin-top: 0.375rem;
}

.codes {
  list-style: none;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem 1rem;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: var(--fs-base);
  text-align: center;
  user-select: all;
}

.actions {
  gap: 0.5rem;
}
</style>

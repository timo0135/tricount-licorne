<script setup lang="ts">
import { computed, ref } from 'vue';
import { Download, Share, SquarePlus, X } from 'lucide-vue-next';
import BrandMark from './BrandMark.vue';
import {
  installEvent,
  installed,
  isIos,
  isStandalone,
  promptInstall,
  rememberDismiss,
  wasDismissedRecently,
} from '@/utils/install';

const dismissed = ref(wasDismissedRecently());
const ios = isIos();

const visible = computed(
  () =>
    !dismissed.value &&
    !installed.value &&
    !isStandalone() &&
    (ios || Boolean(installEvent.value)),
);

function dismiss() {
  dismissed.value = true;
  rememberDismiss();
}

async function install() {
  if (await promptInstall()) dismissed.value = true;
}
</script>

<template>
  <section v-if="visible" class="install card" aria-labelledby="install-title">
    <div class="head">
      <span class="logo"><BrandMark :size="22" /></span>
      <div class="grow">
        <h2 id="install-title">Installer l'application</h2>
        <p class="muted">Ouvre Licorne Tricount depuis ton écran d'accueil, en plein écran.</p>
      </div>
      <button class="icon-btn close" aria-label="Masquer" @click="dismiss">
        <X :size="18" :stroke-width="1.75" />
      </button>
    </div>

    <ol v-if="ios" class="steps">
      <li>
        Touche <Share :size="16" :stroke-width="2" class="inline-icon" aria-label="Partager" />
        <strong>Partager</strong> dans la barre de Safari.
      </li>
      <li>
        Choisis <SquarePlus :size="16" :stroke-width="2" class="inline-icon" aria-hidden="true" />
        <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.
      </li>
    </ol>

    <button v-else class="btn btn-block install-btn" @click="install">
      <Download :size="18" :stroke-width="2" /> Installer
    </button>
  </section>
</template>

<style scoped>
.install {
  margin-bottom: 1.5rem;
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
  flex-shrink: 0;
}

h2 {
  font-size: var(--fs-base);
}

.head p {
  margin-top: 0.125rem;
}

.close {
  margin: -0.5rem -0.5rem 0 0;
}

.steps {
  margin: 0.875rem 0 0;
  padding-left: 1.25rem;
  font-size: var(--fs-sm);
  color: var(--text-2);
  line-height: 1.6;
}

.inline-icon {
  vertical-align: -3px;
  color: var(--accent-text);
}

.install-btn {
  margin-top: 0.875rem;
}
</style>

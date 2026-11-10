<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CircleAlert, Link2 } from 'lucide-vue-next';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import AppHeader from '@/components/AppHeader.vue';

const groups = useGroupsStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();

const code = ref('');
const error = ref('');
const loading = ref(false);

onMounted(() => {
  if (typeof route.query.code === 'string') code.value = route.query.code.toUpperCase();
});

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const group = await groups.joinGroup(code.value.trim());
    toast.success(`Tu as rejoint « ${group.name} »`);
    router.replace(`/groups/${group.id}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page">
    <AppHeader title="Rejoindre un troupeau" back="/" />

    <form class="stack" @submit.prevent="submit">
      <div class="intro">
        <span class="tile"><Link2 :size="22" :stroke-width="1.75" /></span>
        <p class="muted">
          Demande le code d'invitation à un membre du troupeau : il le trouve dans l'onglet
          Membres.
        </p>
      </div>

      <div class="field">
        <label class="label" for="code">Code d'invitation</label>
        <input
          id="code"
          v-model="code"
          class="input code"
          maxlength="16"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck="false"
          required
          @input="code = code.toUpperCase()"
        />
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <button class="btn btn-block" type="submit" :disabled="loading || code.trim().length < 4">
        {{ loading ? 'Recherche…' : 'Rejoindre' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.intro {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.tile {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-text);
  flex-shrink: 0;
}

.code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-align: center;
}
</style>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import AppHeader from '@/components/AppHeader.vue';

const groups = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

const code = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const group = await groups.joinGroup(code.value);
    toast.success(`Bienvenue dans « ${group.name} » ! 🌈`);
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
    <AppHeader title="Rejoindre un troupeau" back />

    <div class="card stack center">
      <span class="emoji float">🔗</span>
      <p class="muted">
        Demande son code d'invitation à la licorne qui a créé le troupeau, puis saisis-le ici.
      </p>

      <form class="stack" @submit.prevent="submit">
        <input
          v-model="code"
          class="input code"
          placeholder="ABC12XYZ"
          maxlength="16"
          autocapitalize="characters"
          required
          @input="code = code.toUpperCase()"
        />

        <p v-if="error" class="error-box">{{ error }}</p>

        <button class="btn btn-block" type="submit" :disabled="loading || code.length < 4">
          {{ loading ? 'Recherche…' : 'Rejoindre 🦄' }}
        </button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.emoji {
  font-size: 3rem;
}

.code {
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.35em;
  text-transform: uppercase;
}
</style>

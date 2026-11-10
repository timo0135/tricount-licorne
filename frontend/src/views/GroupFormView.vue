<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Check, CircleAlert } from 'lucide-vue-next';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { GROUP_EMOJIS, GROUP_TINTS } from '@/utils/format';
import AppHeader from '@/components/AppHeader.vue';
import GroupAvatar from '@/components/GroupAvatar.vue';

const groups = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

const name = ref('');
const description = ref('');
const emoji = ref('🦄');
const tint = ref('aurora');
const currency = ref('EUR');
const saving = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  saving.value = true;
  try {
    const group = await groups.createGroup({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      emoji: emoji.value,
      gradient: tint.value,
      currency: currency.value,
    });
    toast.success('Troupeau créé');
    router.replace(`/groups/${group.id}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="page">
    <AppHeader title="Nouveau troupeau" back="/" />

    <form class="stack" @submit.prevent="submit">
      <div class="card preview">
        <GroupAvatar :emoji="emoji" :tint="tint" :size="52" />
        <div class="grow">
          <p class="list-title truncate">{{ name || 'Nom du troupeau' }}</p>
          <p class="list-sub truncate">{{ description || 'Aperçu' }}</p>
        </div>
      </div>

      <div class="field">
        <label class="label" for="name">Nom</label>
        <input
          id="name"
          v-model="name"
          class="input"
          placeholder="Colocation, Week-end à Crozon…"
          required
          maxlength="60"
        />
      </div>

      <div class="field">
        <label class="label" for="desc">Description <span class="faint">(facultatif)</span></label>
        <textarea id="desc" v-model="description" class="textarea" maxlength="280" />
      </div>

      <div class="field">
        <span class="label" id="emoji-label">Icône</span>
        <div class="scroller" role="radiogroup" aria-labelledby="emoji-label">
          <button
            v-for="e in GROUP_EMOJIS"
            :key="e"
            type="button"
            role="radio"
            :aria-checked="emoji === e"
            class="emoji-option"
            :class="{ active: emoji === e }"
            @click="emoji = e"
          >
            {{ e }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label" id="tint-label">Couleur</span>
        <div class="tints" role="radiogroup" aria-labelledby="tint-label">
          <button
            v-for="(t, key) in GROUP_TINTS"
            :key="key"
            type="button"
            role="radio"
            :aria-checked="tint === key"
            :aria-label="t.label"
            class="tint"
            :style="{ background: t.color }"
            @click="tint = key"
          >
            <Check v-if="tint === key" :size="18" :stroke-width="2.5" color="#fff" />
          </button>
        </div>
      </div>

      <div class="field">
        <label class="label" for="currency">Devise</label>
        <select id="currency" v-model="currency" class="select">
          <option value="EUR">Euro (€)</option>
          <option value="USD">Dollar américain ($)</option>
          <option value="GBP">Livre sterling (£)</option>
          <option value="CHF">Franc suisse (CHF)</option>
        </select>
      </div>

      <p v-if="error" class="alert alert-error" role="alert">
        <CircleAlert :size="16" :stroke-width="2" /> {{ error }}
      </p>

      <button class="btn btn-block" type="submit" :disabled="saving || !name.trim()">
        {{ saving ? 'Création…' : 'Créer le troupeau' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.emoji-option {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-size: 1.25rem;
  cursor: pointer;
}

.emoji-option.active {
  border: 2px solid var(--accent);
  background: var(--accent-soft);
}

.tints {
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.tint {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tint[aria-checked='true'] {
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 4px var(--text);
}
</style>

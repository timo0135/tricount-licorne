<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGroupsStore } from '@/stores/groups';
import { useToastStore } from '@/stores/toast';
import { GRADIENT_KEYS, GROUP_EMOJIS, gradientStyle } from '@/utils/format';
import AppHeader from '@/components/AppHeader.vue';

const groups = useGroupsStore();
const toast = useToastStore();
const router = useRouter();

const name = ref('');
const description = ref('');
const emoji = ref('🦄');
const gradient = ref<string>('aurora');
const currency = ref('EUR');
const saving = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  saving.value = true;
  try {
    const group = await groups.createGroup({
      name: name.value,
      description: description.value || undefined,
      emoji: emoji.value,
      gradient: gradient.value,
      currency: currency.value,
    });
    toast.success('Troupeau créé ! ✨');
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
    <AppHeader title="Nouveau troupeau" back />

    <div class="preview card" :style="{ background: gradientStyle(gradient) }">
      <span class="preview-emoji">{{ emoji }}</span>
      <h2>{{ name || 'Ma prairie' }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>

    <form class="stack" @submit.prevent="submit">
      <div class="field">
        <label class="label" for="name">Nom du troupeau</label>
        <input
          id="name"
          v-model="name"
          class="input"
          placeholder="Week-end à Brocéliande"
          required
          maxlength="60"
        />
      </div>

      <div class="field">
        <label class="label" for="desc">Description (optionnel)</label>
        <textarea
          id="desc"
          v-model="description"
          class="textarea"
          placeholder="Trois jours de paillettes…"
          maxlength="280"
        />
      </div>

      <div class="field">
        <span class="label">Emoji</span>
        <div class="scroller">
          <button
            v-for="e in GROUP_EMOJIS"
            :key="e"
            type="button"
            class="chip"
            :class="{ active: emoji === e }"
            @click="emoji = e"
          >
            {{ e }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">Ambiance</span>
        <div class="scroller">
          <button
            v-for="g in GRADIENT_KEYS"
            :key="g"
            type="button"
            class="swatch"
            :class="{ selected: gradient === g }"
            :style="{ background: gradientStyle(g) }"
            :aria-label="g"
            @click="gradient = g"
          />
        </div>
      </div>

      <div class="field">
        <label class="label" for="currency">Devise</label>
        <select id="currency" v-model="currency" class="select">
          <option value="EUR">€ Euro</option>
          <option value="USD">$ Dollar</option>
          <option value="GBP">£ Livre</option>
          <option value="CHF">CHF Franc suisse</option>
        </select>
      </div>

      <p v-if="error" class="error-box">{{ error }}</p>

      <button class="btn btn-block" type="submit" :disabled="saving || !name">
        {{ saving ? 'Création…' : 'Créer le troupeau ✨' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.preview {
  border: none;
  color: #fff;
  text-align: center;
  padding: 1.6rem 1rem;
  margin-bottom: 1rem;
}

.preview-emoji {
  font-size: 2.6rem;
  display: block;
  margin-bottom: 0.3rem;
}

.preview p {
  font-size: 0.85rem;
  opacity: 0.92;
}

.swatch {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-sm);
  border: 3px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  transition: transform 0.16s ease;
}

.swatch.selected {
  border-color: #fff;
  box-shadow: 0 0 0 3px var(--lilas);
  transform: scale(1.05);
}
</style>

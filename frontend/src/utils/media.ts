import { ref } from 'vue';

/** Largeur à partir de laquelle on passe à la mise en page de bureau. */
export const DESKTOP_QUERY = '(min-width: 1024px)';

const query = typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY) : null;
const isDesktop = ref(query?.matches ?? false);
query?.addEventListener('change', (event) => {
  isDesktop.value = event.matches;
});

/** Vrai sur un écran d'ordinateur (barre latérale, colonnes). */
export const useDesktop = () => isDesktop;

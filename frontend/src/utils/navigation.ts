import { useRouter, type RouteLocationRaw } from 'vue-router';

/**
 * Retour vers un écran « parent » sans empiler d'historique :
 * - si l'écran précédent est ce parent, on revient vraiment en arrière ;
 * - sinon (lien direct, rechargement…), on remplace l'écran actuel par le parent.
 * Ainsi Profil → Sécurité → retour → retour ramène bien à l'accueil.
 */
export function useBackTo() {
  const router = useRouter();

  return (target: RouteLocationRaw = '/') => {
    const previous = window.history.state?.back as string | null | undefined;
    const wanted = router.resolve(target);
    if (previous && router.resolve(previous).path === wanted.path) {
      router.back();
    } else {
      router.replace(wanted);
    }
  };
}

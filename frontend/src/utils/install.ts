import { ref } from 'vue';

/** Événement Chrome/Android permettant d'afficher la fenêtre d'installation. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lt.install.dismissedAt';
const DISMISS_DAYS = 30;

export const installEvent = ref<BeforeInstallPromptEvent | null>(null);
export const installed = ref(false);

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function wasDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible */
  }
}

/** À appeler au démarrage : l'événement peut arriver avant l'affichage des écrans. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent.value = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installed.value = true;
    installEvent.value = null;
  });
}

export async function promptInstall(): Promise<boolean> {
  const event = installEvent.value;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  installEvent.value = null;
  return outcome === 'accepted';
}

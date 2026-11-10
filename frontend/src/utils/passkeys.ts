import {
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { passkeysApi } from '@/api';

export const passkeysSupported = () => browserSupportsWebAuthn();
export const passkeyAutofillSupported = () => browserSupportsWebAuthnAutofill();
export const cancelPasskeyCeremony = () => WebAuthnAbortService.cancelCeremony();

/** Message lisible pour une erreur WebAuthn, ou null si l'utilisateur a simplement annulé. */
export function passkeyErrorMessage(error: unknown): string | null {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return null;
  if (name === 'InvalidStateError') return 'Cet appareil a déjà une passkey pour ton compte.';
  if (name === 'SecurityError') return 'Les passkeys ne fonctionnent que sur le site officiel, en HTTPS.';
  return (error as Error)?.message ?? 'Opération impossible.';
}

/** Crée une passkey sur cet appareil (Face ID, Touch ID, code de l'appareil). */
export async function createPasskey() {
  const optionsJSON = await passkeysApi.registrationOptions();
  const response = await startRegistration({ optionsJSON });
  return passkeysApi.register(response);
}

/**
 * Connexion par passkey. Avec `autofill`, la passkey est proposée dans le clavier
 * ou sous le champ e-mail ; la promesse se résout quand l'utilisateur la choisit.
 */
export async function signInWithPasskey(autofill = false) {
  const optionsJSON = await passkeysApi.loginOptions();
  const response = await startAuthentication({ optionsJSON, useBrowserAutofill: autofill });
  return passkeysApi.login(response);
}

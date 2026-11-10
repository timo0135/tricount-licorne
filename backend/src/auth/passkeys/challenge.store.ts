import { Injectable } from '@nestjs/common';

/** Durée de validité d'un défi WebAuthn. */
const TTL_MS = 5 * 60_000;

/**
 * Défis WebAuthn en attente, gardés en mémoire (une seule instance d'API).
 * Chaque défi ne sert qu'une fois : il est consommé à la vérification.
 */
@Injectable()
export class ChallengeStore {
  private readonly pending = new Map<string, { userId?: string; expiresAt: number }>();

  add(challenge: string, userId?: string) {
    this.purge();
    this.pending.set(challenge, { userId, expiresAt: Date.now() + TTL_MS });
  }

  /** Vrai si le défi existe, n'a pas expiré et appartient à l'utilisateur ; il est alors supprimé. */
  consume(challenge: string, userId?: string): boolean {
    const entry = this.pending.get(challenge);
    this.pending.delete(challenge);
    if (!entry || entry.expiresAt < Date.now()) return false;
    return entry.userId === userId;
  }

  private purge() {
    const now = Date.now();
    for (const [key, entry] of this.pending) if (entry.expiresAt < now) this.pending.delete(key);
  }
}

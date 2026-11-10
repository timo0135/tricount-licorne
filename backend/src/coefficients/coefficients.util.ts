import { splitByWeights } from '../common/split';

/**
 * Coefficients d'un troupeau, exprimés en points de base : 10 000 = 100 %.
 * On travaille en entiers pour la même raison que les montants sont en centimes —
 * la somme d'une catégorie doit toujours retomber exactement sur 100 %.
 */
export const TOTAL_BP = 10_000;

export interface ShareBp {
  userId: string;
  shareBp: number;
}

/** Ramène n'importe quel jeu de poids à une somme de exactement 10 000 bp. */
export function normalizeShares(entries: ShareBp[]): ShareBp[] {
  if (entries.length === 0) return [];

  const positive = entries.filter((e) => e.shareBp > 0);

  // Personne n'a de coefficient : on retombe sur un partage égal.
  if (positive.length === 0) {
    return splitByWeights(
      TOTAL_BP,
      entries.map((e) => ({ userId: e.userId, weight: 1 })),
    ).map((s) => ({ userId: s.userId, shareBp: s.amountCents }));
  }

  const normalized = splitByWeights(
    TOTAL_BP,
    positive.map((e) => ({ userId: e.userId, weight: e.shareBp })),
  );
  const byUser = new Map(normalized.map((n) => [n.userId, n.amountCents]));

  return entries.map((e) => ({ userId: e.userId, shareBp: byUser.get(e.userId) ?? 0 }));
}

/** Coefficients égaux entre toutes les licornes (valeur par défaut d'un troupeau). */
export function equalShares(userIds: string[]): ShareBp[] {
  if (userIds.length === 0) return [];
  return splitByWeights(
    TOTAL_BP,
    userIds.map((userId) => ({ userId, weight: 1 })),
  ).map((s) => ({ userId: s.userId, shareBp: s.amountCents }));
}

/**
 * Arrivée d'une licorne : elle prend un coefficient égal à la moyenne des autres,
 * puis tout le monde est renormalisé — les proportions existantes sont conservées.
 */
export function withNewMember(entries: ShareBp[], userId: string): ShareBp[] {
  if (entries.some((e) => e.userId === userId)) return normalizeShares(entries);

  const positive = entries.filter((e) => e.shareBp > 0);
  const average = positive.length
    ? Math.max(1, Math.round(positive.reduce((sum, e) => sum + e.shareBp, 0) / positive.length))
    : TOTAL_BP;

  return normalizeShares([...entries, { userId, shareBp: average }]);
}

/** Départ d'une licorne : son coefficient est redistribué au prorata des autres. */
export function withoutMember(entries: ShareBp[], userId: string): ShareBp[] {
  return normalizeShares(entries.filter((e) => e.userId !== userId));
}

/** Somme d'une répartition, pour la validation côté API. */
export const sumBp = (entries: ShareBp[]): number =>
  entries.reduce((sum, e) => sum + e.shareBp, 0);

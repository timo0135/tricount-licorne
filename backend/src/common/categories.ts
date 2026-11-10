/** Catégories de dépenses, version licorne. */
export const CATEGORIES = [
  'nourriture',
  'boissons',
  'logement',
  'transport',
  'sorties',
  'courses',
  'shopping',
  'sante',
  'paillettes',
  'autre',
] as const;

export type Category = (typeof CATEGORIES)[number];

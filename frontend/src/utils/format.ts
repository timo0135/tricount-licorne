/** Helpers d'affichage : montants, dates, catégories. */

export const formatMoney = (cents: number, currency = 'EUR'): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);

export const formatMoneySigned = (cents: number, currency = 'EUR'): string =>
  `${cents > 0 ? '+' : ''}${formatMoney(cents, currency)}`;

/** "12,50" ou "12.50" -> 1250 centimes */
export const parseAmountToCents = (value: string): number => {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
};

export const centsToInput = (cents: number): string => (cents / 100).toFixed(2).replace('.', ',');

/** Coefficients : 10 000 points de base = 100 %. */
export const TOTAL_BP = 10_000;

export const bpToInput = (bp: number): string =>
  bp % 100 === 0 ? String(bp / 100) : (bp / 100).toFixed(2).replace('.', ',');

export const parseInputToBp = (value: string): number => {
  const normalized = value.replace(/\s|%/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(TOTAL_BP, Math.round(parsed * 100)));
};

export const formatPercent = (bp: number): string => `${bpToInput(bp)} %`;

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateShort = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

export const toDateInput = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

export const CATEGORY_META: Record<string, { label: string; emoji: string; color: string }> = {
  nourriture: { label: 'Nourriture', emoji: '🍽️', color: '#ffc48f' },
  boissons: { label: 'Boissons', emoji: '🥤', color: '#8fc4ff' },
  logement: { label: 'Logement', emoji: '🏰', color: '#b98cf5' },
  transport: { label: 'Transport', emoji: '🚗', color: '#7fe3cd' },
  sorties: { label: 'Sorties', emoji: '🎪', color: '#ff9ecf' },
  courses: { label: 'Courses', emoji: '🛒', color: '#a8e06a' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#f5a2e0' },
  sante: { label: 'Santé', emoji: '💊', color: '#ff9aa9' },
  paillettes: { label: 'Paillettes', emoji: '✨', color: '#ffd76a' },
  autre: { label: 'Autre', emoji: '🦄', color: '#c9a7f5' },
};

export const categoryMeta = (key: string) => CATEGORY_META[key] ?? CATEGORY_META.autre;

export const GRADIENT_KEYS = ['aurora', 'candy', 'lagoon', 'sunset', 'meadow', 'cosmos'] as const;

export const gradientStyle = (key: string): string =>
  `var(--gradient-${GRADIENT_KEYS.includes(key as never) ? key : 'aurora'})`;

export const GROUP_EMOJIS = ['🦄', '🌈', '✨', '🏰', '🌲', '🏖️', '🎂', '🏠', '🎿', '🍭', '🎪', '🧁'];

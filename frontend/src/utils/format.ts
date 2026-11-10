import type { Component } from 'vue';
import {
  Car,
  CupSoda,
  HeartPulse,
  House,
  Shapes,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Ticket,
  Utensils,
} from 'lucide-vue-next';

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
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Libellé de regroupement par jour : « Aujourd'hui », « Hier » ou la date. */
export const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
};

export const toDateInput = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

/** Catégories : libellé, icône et teinte (utilisée en fond très léger). */
export interface CategoryMeta {
  label: string;
  icon: Component;
  color: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  nourriture: { label: 'Nourriture', icon: Utensils, color: '#c2410c' },
  boissons: { label: 'Boissons', icon: CupSoda, color: '#0369a1' },
  logement: { label: 'Logement', icon: House, color: '#6d28d9' },
  transport: { label: 'Transport', icon: Car, color: '#0f766e' },
  sorties: { label: 'Sorties', icon: Ticket, color: '#be185d' },
  courses: { label: 'Courses', icon: ShoppingCart, color: '#4d7c0f' },
  shopping: { label: 'Shopping', icon: ShoppingBag, color: '#a21caf' },
  sante: { label: 'Santé', icon: HeartPulse, color: '#b91c1c' },
  paillettes: { label: 'Paillettes', icon: Sparkles, color: '#a16207' },
  autre: { label: 'Autre', icon: Shapes, color: '#57534e' },
};

export const categoryMeta = (key: string): CategoryMeta => CATEGORY_META[key] ?? CATEGORY_META.autre;

/**
 * Couleur d'un troupeau. Le champ `gradient` est conservé en base pour la
 * compatibilité, mais il désigne désormais une teinte unie.
 */
export const GROUP_TINTS: Record<string, { label: string; color: string }> = {
  aurora: { label: 'Violet', color: '#6d28d9' },
  candy: { label: 'Rose', color: '#db2777' },
  lagoon: { label: 'Bleu lagon', color: '#0e7490' },
  sunset: { label: 'Orange', color: '#ea580c' },
  meadow: { label: 'Vert', color: '#15803d' },
  cosmos: { label: 'Indigo', color: '#4338ca' },
};

export const GRADIENT_KEYS = Object.keys(GROUP_TINTS);

export const groupTint = (key: string): string => (GROUP_TINTS[key] ?? GROUP_TINTS.aurora).color;

export const GROUP_EMOJIS = ['🦄', '🌈', '🏠', '🏖️', '🏔️', '🎿', '🚐', '🎂', '🍕', '🎉', '⛺', '✈️'];

/** Fond teinté léger, lisible en mode clair comme en mode sombre. */
export const tintBg = (color: string, percent = 14): string =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/** « Toi » pour l'utilisateur courant, sinon le prénom. */
export const displayName = (user: { id: string; name: string } | undefined, meId: string): string =>
  !user ? 'Membre' : user.id === meId ? 'Toi' : user.name;

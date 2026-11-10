/** Petite bibliothèque licorne : emojis, couleurs pastel et codes d'invitation. */

export const UNICORN_EMOJIS = ['🦄', '🌈', '✨', '🍭', '🌸', '⭐️', '🧁', '🪄', '☁️', '🫧', '🍬', '💜'];

export const PASTEL_COLORS = [
  '#F7A8C4', // rose bonbon
  '#C9A7F5', // lavande
  '#A7E8D8', // menthe
  '#FFD59E', // pêche
  '#A9CBF5', // ciel
  '#F5B8E8', // orchidée
  '#BDF5A7', // pistache
  '#FFC7C7', // corail doux
];

export const GRADIENTS = ['aurora', 'candy', 'lagoon', 'sunset', 'meadow', 'cosmos'];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const randomEmoji = () => pick(UNICORN_EMOJIS);
export const randomColor = () => pick(PASTEL_COLORS);
export const randomGradient = () => pick(GRADIENTS);

/** Code d'invitation lisible, sans caractères ambigus (0/O, 1/I). */
export function generateInviteCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

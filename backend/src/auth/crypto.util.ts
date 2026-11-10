import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Chiffrement symétrique des petits secrets stockés en base (secret TOTP).
 * AES-256-GCM : confidentialité + intégrité. Format : v1:<iv>.<tag>.<données> en base64url.
 */
const keyFrom = (material: string) => createHash('sha256').update(material).digest();

export function encryptSecret(plain: string, keyMaterial: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyMaterial), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`;
}

export function decryptSecret(payload: string, keyMaterial: string): string {
  const [version, rest] = payload.split(':');
  if (version !== 'v1' || !rest) throw new Error('Format de secret chiffré inconnu');
  const [iv, tag, data] = rest.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyMaterial), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Taille maximale acceptée par le serveur. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 2400;

/**
 * Réduit côté navigateur les grosses photos (12 Mpx d'un téléphone) avant l'envoi :
 * moins de données mobiles, envoi plus rapide. Le serveur recadre ensuite.
 * En cas d'échec, le fichier d'origine est envoyé tel quel.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.88),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Message d'erreur si le fichier ne peut pas être envoyé, sinon null. */
export function checkImage(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Choisis une image (JPEG, PNG, WebP ou GIF).';
  if (file.size > 25 * 1024 * 1024) return 'Image trop lourde.';
  return null;
}

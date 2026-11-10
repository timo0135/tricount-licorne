import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';
import type { AppEnv } from '../config/env.validation';

/** Préfixe public des fichiers envoyés, servis en statique par l'API. */
export const UPLOADS_PREFIX = '/api/uploads/';
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type ImageKind = 'avatar' | 'group' | 'banner';

/** Format de sortie de chaque type d'image (recadrage centré sur le sujet). */
const FORMATS: Record<ImageKind, { width: number; height: number }> = {
  avatar: { width: 512, height: 512 },
  group: { width: 512, height: 512 },
  banner: { width: 1500, height: 500 },
};

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly dir: string;

  constructor(config: ConfigService<AppEnv, true>) {
    this.dir = config.get('UPLOADS_DIR', { infer: true });
  }

  get directory() {
    return this.dir;
  }

  /**
   * Valide, recadre et convertit une image en WebP. Les métadonnées (EXIF,
   * position GPS…) sont supprimées. Renvoie le chemin public du fichier.
   */
  async saveImage(file: UploadedImage | undefined, kind: ImageKind): Promise<string> {
    if (!file?.buffer?.length) throw new BadRequestException('Aucune image reçue.');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Image trop lourde (8 Mo maximum).');
    }

    const { width, height } = FORMATS[kind];
    let output: Buffer;
    try {
      const meta = await sharp(file.buffer).metadata();
      if (!meta.width || !meta.height) throw new Error('dimensions inconnues');
      output = await sharp(file.buffer, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize(width, height, { fit: 'cover', position: sharp.strategy.attention })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Format d’image non pris en charge (JPEG, PNG, WebP ou GIF).');
    }

    await mkdir(this.dir, { recursive: true });
    const name = `${kind}-${randomUUID()}.webp`;
    await writeFile(join(this.dir, name), output);
    return `${UPLOADS_PREFIX}${name}`;
  }

  /** Supprime un fichier envoyé précédemment (sans erreur s'il n'existe plus). */
  async remove(url: string | null | undefined) {
    if (!url?.startsWith(UPLOADS_PREFIX)) return;
    const name = basename(url);
    try {
      await unlink(join(this.dir, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Suppression impossible de ${name} : ${(error as Error).message}`);
      }
    }
  }
}

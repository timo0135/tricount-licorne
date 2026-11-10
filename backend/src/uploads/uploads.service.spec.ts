import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let dir: string;
  let service: UploadsService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uploads-'));
    service = new UploadsService({ get: () => dir } as never);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const photo = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#6d28d9' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret' } } })
      .toBuffer();

  const fileOf = (url: string) => join(dir, url.replace('/api/uploads/', ''));

  it('recadre une photo de profil en carré WebP de 512 px, sans métadonnées', async () => {
    const buffer = await photo(1200, 800);
    const url = await service.saveImage({ buffer, size: buffer.length }, 'avatar');
    expect(url).toMatch(/^\/api\/uploads\/avatar-[0-9a-f-]+\.webp$/);
    const meta = await sharp(readFileSync(fileOf(url))).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 512, 512]);
    expect(meta.exif).toBeUndefined();
  });

  it('recadre une bannière en 1500 × 500', async () => {
    const buffer = await photo(800, 1200);
    const url = await service.saveImage({ buffer, size: buffer.length }, 'banner');
    const meta = await sharp(readFileSync(fileOf(url))).metadata();
    expect([meta.width, meta.height]).toEqual([1500, 500]);
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    const buffer = Buffer.from('<?php echo "non"; ?>');
    await expect(service.saveImage({ buffer, size: buffer.length }, 'avatar')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('supprime un fichier envoyé, et ignore les chemins étrangers', async () => {
    const buffer = await photo(100, 100);
    const url = await service.saveImage({ buffer, size: buffer.length }, 'group');
    await service.remove(url);
    expect(existsSync(fileOf(url))).toBe(false);
    await expect(service.remove('/etc/passwd')).resolves.toBeUndefined();
    await expect(service.remove('/api/uploads/../../etc/passwd')).resolves.toBeUndefined();
  });
});

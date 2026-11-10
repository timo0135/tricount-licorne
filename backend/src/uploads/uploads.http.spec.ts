import { Controller, Module, Put, UploadedFile } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { UploadsModule } from './uploads.module';
import { UPLOADS_PREFIX, UploadedImage, UploadsService } from './uploads.service';
import { ImageUpload } from './image-upload.decorator';

/** Chaîne complète sans base : envoi multipart → sharp → fichier servi par l'API. */
const dir = mkdtempSync(join(tmpdir(), 'uploads-http-'));

@Controller('test')
class TestController {
  constructor(private uploads: UploadsService) {}

  @Put('banner')
  @ImageUpload()
  async banner(@UploadedFile() file: UploadedImage) {
    return { url: await this.uploads.saveImage(file, 'banner') };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({ UPLOADS_DIR: dir })] }), UploadsModule],
  controllers: [TestController],
})
class TestModule {}

describe('envoi et service des photos (HTTP)', () => {
  let app: NestExpressApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
    app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
    app.useStaticAssets(dir, { prefix: UPLOADS_PREFIX, immutable: true, maxAge: '365d', index: false, fallthrough: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('enregistre la bannière puis la sert en image/webp', async () => {
    const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#0ea5e9' } })
      .jpeg()
      .toBuffer();
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'photo.jpg');

    const put = await fetch(`${base}/api/test/banner`, { method: 'PUT', body: form });
    expect(put.status).toBe(200);
    const { url } = await put.json();
    expect(url).toMatch(/^\/api\/uploads\/banner-.+\.webp$/);

    const get = await fetch(`${base}${url}`);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toContain('image/webp');
    const meta = await sharp(Buffer.from(await get.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([1500, 500]);
  });

  it('répond 404 pour un fichier inexistant', async () => {
    const res = await fetch(`${base}/api/uploads/inconnu.webp`);
    expect(res.status).toBe(404);
  });
});

import { BadRequestException, Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function detectImage(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') {
    return 'webp';
  }
  return null;
}

/** Stores visitor photos on local disk. Swap this class for an S3/R2 implementation in production if needed. */
@Injectable()
export class StorageService {
  readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('UPLOAD_DIR') ?? './uploads');
  }

  /** Returns a public path such as /uploads/photos/<uuid>.jpg */
  async saveImage(buffer: Buffer): Promise<string> {
    const kind = detectImage(buffer);
    if (!kind) throw new BadRequestException('The photo must be a JPEG, PNG or WebP image.');
    const dir = join(this.root, 'photos');
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${kind}`;
    await writeFile(join(dir, name), buffer);
    return `/uploads/photos/${name}`;
  }

  async remove(publicPath: string | null | undefined) {
    if (!publicPath?.startsWith('/uploads/photos/')) return;
    const name = publicPath.slice('/uploads/photos/'.length);
    if (name.includes('/') || name.includes('..')) return;
    await unlink(join(this.root, 'photos', name)).catch(() => undefined);
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}

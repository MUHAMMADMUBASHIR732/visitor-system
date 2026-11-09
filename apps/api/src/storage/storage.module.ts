import { BadRequestException, Controller, Get, Global, Header, Inject, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SERVERLESS } from '../common/runtime';
import { DB, Database } from '../db/db.module';
import { photos } from '../db/schema';

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

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
const DB_PREFIX = '/api/photos/';
const DISK_PREFIX = '/uploads/photos/';

/**
 * Stores visitor photos. On a normal server they go to local disk; on serverless hosting (no disk) they
 * are kept in the database and served from /api/photos/<id>.
 */
@Injectable()
export class StorageService {
  readonly root: string;

  constructor(
    config: ConfigService,
    @Inject(DB) private readonly db: Database,
  ) {
    this.root = resolve(config.get<string>('UPLOAD_DIR') ?? './uploads');
  }

  /** Returns a public path such as /uploads/photos/<uuid>.jpg or /api/photos/<uuid>. */
  async saveImage(buffer: Buffer): Promise<string> {
    const kind = detectImage(buffer);
    if (!kind) throw new BadRequestException('The photo must be a JPEG, PNG or WebP image.');
    if (SERVERLESS) {
      const [row] = await this.db.insert(photos).values({ mime: MIME[kind], data: buffer }).returning({ id: photos.id });
      return `${DB_PREFIX}${row.id}`;
    }
    const dir = join(this.root, 'photos');
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${kind}`;
    await writeFile(join(dir, name), buffer);
    return `${DISK_PREFIX}${name}`;
  }

  async read(id: string) {
    const [row] = await this.db.select().from(photos).where(eq(photos.id, id)).limit(1);
    return row ?? null;
  }

  async remove(publicPath: string | null | undefined) {
    if (!publicPath) return;
    if (publicPath.startsWith(DB_PREFIX)) {
      await this.db.delete(photos).where(eq(photos.id, publicPath.slice(DB_PREFIX.length))).catch(() => undefined);
      return;
    }
    if (!publicPath.startsWith(DISK_PREFIX)) return;
    const name = publicPath.slice(DISK_PREFIX.length);
    if (name.includes('/') || name.includes('..')) return;
    await unlink(join(this.root, 'photos', name)).catch(() => undefined);
  }
}

/** Serves database-stored photos. The id is an unguessable UUID, like the file names on disk. */
@Controller('photos')
export class PhotosController {
  constructor(private readonly storage: StorageService) {}

  @Get(':id')
  @Header('Cache-Control', 'public, max-age=604800, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async get(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const photo = await this.storage.read(id);
    if (!photo) throw new NotFoundException();
    res.setHeader('Content-Type', photo.mime);
    res.send(photo.data);
  }
}

@Global()
@Module({ controllers: [PhotosController], providers: [StorageService], exports: [StorageService] })
export class StorageModule {}

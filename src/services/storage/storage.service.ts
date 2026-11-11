import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../../config/env.js';

export interface StoredFile {
  /** Storage key (file name). Pass to `remove`. */
  key: string;
  /** Public absolute URL the browser can load. */
  url: string;
}

/**
 * Where uploaded product photos live. To use S3, Cloudflare R2 or Cloudinary, implement this
 * interface and return it from `createStorageService`; nothing else in the app changes.
 */
export interface StorageService {
  save(file: { buffer: Buffer; extension: string }): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

export const uploadDir = resolve(env.UPLOAD_DIR);

/** Stores files on this server's disk, served by Express at /uploads/*. */
export class LocalStorageService implements StorageService {
  async save({ buffer, extension }: { buffer: Buffer; extension: string }): Promise<StoredFile> {
    await mkdir(uploadDir, { recursive: true });
    // Random, unguessable name; the extension comes from our own content sniffing, never from the client.
    const key = `${randomUUID()}.${extension}`;
    await writeFile(resolve(uploadDir, key), buffer, { flag: 'wx' });
    return { key, url: `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/uploads/${key}` };
  }

  async remove(key: string): Promise<void> {
    // Only plain generated names are accepted, so a key can never escape the upload folder.
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) return;
    await rm(resolve(uploadDir, key), { force: true });
  }
}

function createStorageService(): StorageService {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return new LocalStorageService();
  }
}

export const storageService: StorageService = createStorageService();

// ── Content sniffing ──

export type ImageType = { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; extension: 'jpg' | 'png' | 'webp' };

/**
 * Identifies an image by its first bytes (magic numbers), not by the client-supplied name or MIME type
 * which can be faked. SVG is deliberately NOT accepted: SVG files can contain scripts.
 */
export function sniffImage(buffer: Buffer): ImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return null;
}

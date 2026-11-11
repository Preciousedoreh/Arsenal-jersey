'use client';

import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { Alert, inputClass } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

const MAX_MB = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** What each position in the gallery is used for on the product page. */
const SLOT_LABELS = ['Front', 'Back', 'Detail'];

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  /** Label for each slot, in order. Pass [] for a plain list (e.g. a category photo). */
  slotLabels?: string[];
}

/**
 * Upload photos from the computer (or paste a link), then order them. The first three are the
 * front, back and detail views the product page expects; extra photos follow.
 */
export function ImageUploader({ images, onChange, max = 10, slotLabels = SLOT_LABELS }: ImageUploaderProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [url, setUrl] = useState('');

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = max - images.length;
    const chosen = [...files].slice(0, Math.max(0, room));
    const problems: string[] = files.length > chosen.length ? [`Only ${max} photos are allowed — extra files were skipped.`] : [];
    const added: string[] = [];

    setUploading(chosen.length);
    for (const file of chosen) {
      if (!ACCEPTED.includes(file.type)) {
        problems.push(`${file.name}: use a JPEG, PNG or WebP image.`);
      } else if (file.size > MAX_MB * 1024 * 1024) {
        problems.push(`${file.name}: larger than ${MAX_MB} MB.`);
      } else {
        try {
          added.push((await adminApi.upload(file)).data.url);
        } catch (error) {
          problems.push(`${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`);
        }
      }
      setUploading((n) => n - 1);
    }
    if (added.length > 0) onChange([...images, ...added]);
    setErrors(problems);
    if (fileRef.current) fileRef.current.value = '';
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  const addUrl = () => {
    try {
      const parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      onChange([...images, parsed.toString()]);
      setUrl('');
      setErrors([]);
    } catch {
      setErrors(['Enter a full image link starting with https://']);
    }
  };

  const slotName = (i: number) => slotLabels[i] ?? `Photo ${i + 1}`;
  const full = images.length >= max;

  return (
    <div>
      {images.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="border border-line bg-white">
              <div className="relative aspect-square bg-surface">
                {/* Plain <img>: admins can paste links from any host, so next/image's host allow-list doesn't apply here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${slotName(i)} photo`} className="absolute inset-0 size-full object-contain p-2" />
                <span className="eyebrow absolute left-2 top-2 bg-ink px-1.5 py-0.5 text-white">{slotName(i)}</span>
              </div>
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className="flex">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${slotName(i)} photo earlier`} className="grid size-8 place-items-center text-ink/60 hover:text-ink disabled:opacity-25">
                    <ArrowLeft aria-hidden className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label={`Move ${slotName(i)} photo later`} className="grid size-8 place-items-center text-ink/60 hover:text-ink disabled:opacity-25">
                    <ArrowRight aria-hidden className="size-4" />
                  </button>
                </span>
                <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label={`Remove ${slotName(i)} photo`} className="grid size-8 place-items-center text-ink/60 hover:text-primary">
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} id={inputId} type="file" accept={ACCEPTED.join(',')} multiple={max > 1} onChange={(e) => upload(e.target.files)} disabled={full || uploading > 0} className="sr-only" />
        <label
          htmlFor={inputId}
          className={cn(
            'inline-flex h-10 cursor-pointer items-center gap-2 rounded-btn border border-ink/20 bg-white px-4 text-micro font-semibold uppercase tracking-label transition-colors hover:border-ink',
            (full || uploading > 0) && 'pointer-events-none opacity-50',
          )}
        >
          {uploading > 0 ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
          {uploading > 0 ? `Uploading ${uploading}…` : 'Upload photos'}
        </label>
        <span className="text-micro text-muted">
          JPEG, PNG or WebP, up to {MAX_MB} MB each · {images.length}/{max}
        </span>
      </div>

      <div className="mt-3 flex max-w-xl gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="…or paste an image link"
          aria-label="Image link"
          disabled={full}
          className={inputClass}
        />
        <Button type="button" variant="secondary" size="sm" onClick={addUrl} disabled={full || !url.trim()} className="h-10 shrink-0">
          Add link
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((message) => (
            <Alert key={message}>{message}</Alert>
          ))}
        </div>
      )}
    </div>
  );
}

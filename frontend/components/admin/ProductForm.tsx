'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Alert, FormField, Panel, Spinner, centsToDollars, dollarsToCents, inputClass, textareaClass } from '@/components/admin/ui';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { Button } from '@/components/ui/Button';
import { adminApi, type ProductInput } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Size } from '@/types';
import type { ApiCategory, ApiProduct } from '@/types/api';

const ALL_SIZES: Size[] = ['S', 'M', 'L', 'XL', 'XXL', 'OS'];
const APPAREL: Size[] = ['S', 'M', 'L', 'XL', 'XXL'];
const sizeName = (s: Size) => (s === 'OS' ? 'One size' : s);
const HEX = /^#[0-9a-fA-F]{6}$/;

interface FormState {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  subtitle: string;
  description: string;
  price: string;
  isCustomizable: boolean;
  printPrice: string;
  printColor: string;
  images: string[];
  /** Per size: offered? and its stock (as typed). */
  sizes: Record<Size, { on: boolean; stock: string }>;
  features: string[];
  specs: { label: string; value: string }[];
  tags: string;
  badge: '' | 'NEW' | 'LIMITED';
  isFeatured: boolean;
  isBestSeller: boolean;
  colorName: string;
  colorHex: string;
  lowStockThreshold: string;
  isActive: boolean;
}

const emptySizes = (on: Size[]): FormState['sizes'] =>
  Object.fromEntries(ALL_SIZES.map((s) => [s, { on: on.includes(s), stock: '0' }])) as FormState['sizes'];

function initialState(p?: ApiProduct): FormState {
  if (!p) {
    return {
      name: '', slug: '', sku: '', categoryId: '', subtitle: '', description: '', price: '', isCustomizable: false, printPrice: '15.00', printColor: '#FFFFFF',
      images: [], sizes: emptySizes(APPAREL), features: [], specs: [], tags: '', badge: '', isFeatured: false, isBestSeller: false,
      colorName: '', colorHex: '', lowStockThreshold: '5', isActive: true,
    };
  }
  const sizes = emptySizes([]);
  for (const s of p.sizes) sizes[s.size] = { on: true, stock: String(s.stockQuantity) };
  return {
    name: p.name, slug: p.slug, sku: p.sku, categoryId: p.category.id, subtitle: p.subtitle ?? '', description: p.description,
    price: centsToDollars(p.priceCents), isCustomizable: p.isCustomizable, printPrice: centsToDollars(p.printPriceCents), printColor: p.printColor ?? '#FFFFFF',
    images: p.images, sizes, features: p.features, specs: p.specs, tags: p.tags.join(', '), badge: p.badge ?? '',
    isFeatured: p.isFeatured, isBestSeller: p.isBestSeller, colorName: p.colorName ?? '', colorHex: p.colorHex ?? '',
    lowStockThreshold: String(p.lowStockThreshold ?? 5), isActive: p.isActive ?? true,
  };
}

const slugify = (v: string) => v.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const int = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);

/** Create or edit a product: details, photos, price, personalisation, per-size stock and where it shows on the storefront. */
export function ProductForm({ product, onSaved }: { product?: ApiProduct; onSaved?: (product: ApiProduct) => void }) {
  const router = useRouter();
  const editing = Boolean(product);
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [saved, setSaved] = useState<ApiProduct | undefined>(product);
  const [form, setForm] = useState<FormState>(() => initialState(product));
  const [slugTouched, setSlugTouched] = useState(editing);
  const [categories, setCategories] = useState<ApiCategory[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    adminApi.categories().then(({ data }) => setCategories(data)).catch(() => setCategories([]));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSize = (size: Size, patch: Partial<FormState['sizes'][Size]>) => setForm((f) => ({ ...f, sizes: { ...f.sizes, [size]: { ...f.sizes[size], ...patch } } }));
  const existing = useMemo(() => new Map((saved?.sizes ?? []).map((s) => [s.size, s.stockQuantity])), [saved]);

  /** Client-side checks; the server validates again. */
  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = 'Enter a name (at least 2 characters).';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]+$/.test(form.sku.trim())) e.sku = 'Letters, numbers, dashes and underscores only (min 2).';
    if (!form.categoryId) e.categoryId = 'Choose a category.';
    if (dollarsToCents(form.price) === null) e.price = 'Enter a price, e.g. 89.00';
    if (form.isCustomizable && dollarsToCents(form.printPrice) === null) e.printPrice = 'Enter the print price, e.g. 15.00';
    if (form.isCustomizable && !HEX.test(form.printColor)) e.printColor = 'Use a #RRGGBB colour.';
    if (form.colorHex && !HEX.test(form.colorHex)) e.colorHex = 'Use a #RRGGBB colour.';
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) e.slug = 'Lowercase letters, numbers and single dashes.';
    if (int(form.lowStockThreshold) === null) e.lowStockThreshold = 'Whole number, 0 or more.';
    const on = ALL_SIZES.filter((s) => form.sizes[s].on);
    if (on.length === 0) e.sizes = 'Offer at least one size.';
    else if (on.some((s) => int(form.sizes[s].stock) === null)) e.sizes = 'Stock must be a whole number, 0 or more.';
    if (form.specs.some((r) => !r.label.trim() !== !r.value.trim())) e.specs = 'Fill in both the label and the value, or remove the row.';
    return e;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setAttempted(true);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage({ tone: 'error', text: 'Please fix the highlighted fields.' });
      document.getElementById(id(Object.keys(found)[0]!))?.focus();
      return;
    }

    const body: ProductInput = {
      name: form.name.trim(),
      ...(form.slug ? { slug: form.slug } : {}),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim(),
      categoryId: form.categoryId,
      priceCents: dollarsToCents(form.price)!,
      sku: form.sku.trim(),
      images: form.images,
      features: form.features.map((f) => f.trim()).filter(Boolean),
      specs: form.specs.map((r) => ({ label: r.label.trim(), value: r.value.trim() })).filter((r) => r.label && r.value),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      badge: form.badge || null,
      isFeatured: form.isFeatured,
      isBestSeller: form.isBestSeller,
      isCustomizable: form.isCustomizable,
      printPriceCents: form.isCustomizable ? dollarsToCents(form.printPrice)! : 1500,
      printColor: form.isCustomizable ? form.printColor : null,
      colorName: form.colorName.trim() || null,
      colorHex: form.colorHex.trim() || null,
      lowStockThreshold: int(form.lowStockThreshold)!,
      isActive: form.isActive,
    };

    setBusy(true);
    try {
      if (!editing) {
        const sizes = ALL_SIZES.filter((s) => form.sizes[s].on).map((size) => ({ size, stockQuantity: int(form.sizes[size].stock)! }));
        const { data } = await adminApi.createProduct({ ...body, sizes });
        router.replace(`/admin/products/${data.id}?created=1`);
        return;
      }

      await adminApi.updateProduct(product!.id, body);
      // Stock goes through the audited stock endpoint, one size at a time.
      let latest = (await adminApi.product(product!.id)).data;
      for (const size of ALL_SIZES) {
        const row = form.sizes[size];
        if (!row.on) continue;
        const wanted = int(row.stock)!;
        const current = latest.sizes.find((s) => s.size === size)?.stockQuantity;
        if (current === undefined || current !== wanted) {
          latest = (await adminApi.setStock(product!.id, { size, set: wanted, note: 'Set from the admin product page' })).data;
        }
      }
      setSaved(latest);
      setForm(initialState(latest));
      onSaved?.(latest);
      setMessage({ tone: 'success', text: 'Saved.' });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of error.details as { path: string; message: string }[]) fieldErrors[issue.path.split('.')[0] ?? 'form'] ??= issue.message;
        setErrors(fieldErrors);
        setMessage({ tone: 'error', text: `Some fields were rejected: ${Object.entries(fieldErrors).map(([k, v]) => `${k} — ${v}`).join('; ')}` });
      } else {
        const field = error instanceof ApiError && error.code === 'SLUG_TAKEN' ? 'slug' : error instanceof ApiError && error.code === 'ALREADY_EXISTS' ? 'sku' : null;
        if (field) setErrors({ [field]: error instanceof Error ? error.message : 'Already in use' });
        setMessage({ tone: 'error', text: error instanceof ApiError && error.code === 'ALREADY_EXISTS' ? 'That SKU or slug is already used by another product.' : error instanceof Error ? error.message : 'Could not save.' });
      }
    } finally {
      setBusy(false);
    }
  };

  // After a first failed submit, errors update as the fields are fixed (and the banner clears when none are left).
  useEffect(() => {
    if (!attempted) return;
    const live = validate();
    setErrors(live);
    if (Object.keys(live).length === 0) setMessage((m) => (m?.tone === 'error' && m.text.startsWith('Please fix') ? null : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  if (categories === null) return <Spinner label="Loading…" />;

  const err = (k: string) => errors[k];
  const describe = (k: string) => (err(k) ? `${id(k)}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 pb-24">
      <Panel title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor={id('name')} error={err('name')}>
            <input
              id={id('name')} value={form.name} aria-invalid={!!err('name')} aria-describedby={describe('name')} className={inputClass} placeholder="e.g. Home 26"
              onChange={(e) => {
                set('name', e.target.value);
                if (!slugTouched) set('slug', slugify(e.target.value));
              }}
            />
          </FormField>
          <FormField label="Subtitle" htmlFor={id('subtitle')} hint="Optional short line under the name, e.g. “2026 Home Kit”.">
            <input id={id('subtitle')} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Category" htmlFor={id('categoryId')} error={err('categoryId')} hint={categories.length === 0 ? undefined : undefined}>
            <select id={id('categoryId')} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-invalid={!!err('categoryId')} aria-describedby={describe('categoryId')} className={inputClass}>
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.isActive ? '' : ' (hidden)'}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="mt-1 text-micro text-muted">
                No categories yet — <Link href="/admin/categories" className="underline">create one first</Link>.
              </p>
            )}
          </FormField>
          <FormField label="SKU" htmlFor={id('sku')} error={err('sku')} hint="Your own unique stock code.">
            <input id={id('sku')} value={form.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} aria-invalid={!!err('sku')} aria-describedby={describe('sku')} className={inputClass} placeholder="RL-HOME-2627" />
          </FormField>
          <FormField label="Page address (slug)" htmlFor={id('slug')} error={err('slug')} hint={`Shown in the link: /products/${form.slug || '…'}. Made from the name unless you change it.`} className="sm:col-span-2">
            <input
              id={id('slug')} value={form.slug} aria-invalid={!!err('slug')} aria-describedby={describe('slug')} className={inputClass}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value.toLowerCase());
              }}
            />
          </FormField>
          <FormField label="Description" htmlFor={id('description')} className="sm:col-span-2">
            <textarea id={id('description')} value={form.description} onChange={(e) => set('description', e.target.value)} className={textareaClass} rows={4} />
          </FormField>
        </div>
      </Panel>

      <Panel title="Photos" description="The first three are shown as Front, Back and Detail on the product page. Put the best shot first.">
        <ImageUploader images={form.images} onChange={(images) => set('images', images)} />
      </Panel>

      <Panel title="Price & personalisation">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Price (USD)" htmlFor={id('price')} error={err('price')}>
            <input id={id('price')} inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} aria-invalid={!!err('price')} aria-describedby={describe('price')} className={inputClass} placeholder="89.00" />
          </FormField>
        </div>
        <label className="mt-5 flex w-fit cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={form.isCustomizable} onChange={(e) => set('isCustomizable', e.target.checked)} className="size-4 accent-primary" />
          Offer name &amp; number printing
        </label>
        {form.isCustomizable && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <FormField label="Print price (USD)" htmlFor={id('printPrice')} error={err('printPrice')} hint="Added to the price when personalised.">
              <input id={id('printPrice')} inputMode="decimal" value={form.printPrice} onChange={(e) => set('printPrice', e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Lettering colour" htmlFor={id('printColor')} error={err('printColor')} hint="For the live preview on the back view.">
              <span className="flex gap-2">
                <input type="color" aria-label="Pick lettering colour" value={HEX.test(form.printColor) ? form.printColor : '#ffffff'} onChange={(e) => set('printColor', e.target.value.toUpperCase())} className="h-10 w-12 shrink-0 cursor-pointer rounded-btn border border-line bg-white p-1" />
                <input id={id('printColor')} value={form.printColor} onChange={(e) => set('printColor', e.target.value)} className={inputClass} />
              </span>
            </FormField>
          </div>
        )}
      </Panel>

      <Panel title="Sizes & stock" description={editing ? 'Change a number to set that size’s stock — every change is recorded in the stock history. Sizes can’t be removed; set the stock to 0 to mark one sold out.' : 'Tick the sizes you sell and enter the opening stock for each.'}>
        {!editing && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setForm((f) => ({ ...f, sizes: { ...emptySizes(APPAREL), ...Object.fromEntries(APPAREL.map((s) => [s, { on: true, stock: f.sizes[s].stock }])) } as FormState['sizes'] }))}>
              Apparel sizes (S–XXL)
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setForm((f) => ({ ...f, sizes: { ...emptySizes(['OS']), OS: { on: true, stock: f.sizes.OS.stock } } }))}>
              One size only
            </Button>
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_SIZES.map((size) => {
            const row = form.sizes[size];
            const locked = editing && existing.has(size); // existing sizes stay; only their stock changes
            const stockId = id(`stock-${size}`);
            return (
              <li key={size} className={cn('flex items-center gap-3 border p-3', row.on ? 'border-ink/25 bg-white' : 'border-line bg-surface')}>
                <label className="flex w-24 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={row.on} disabled={locked} onChange={(e) => setSize(size, { on: e.target.checked })} className="size-4 accent-primary" />
                  {sizeName(size)}
                </label>
                <label htmlFor={stockId} className="sr-only">
                  Stock for {sizeName(size)}
                </label>
                <input id={stockId} inputMode="numeric" value={row.stock} disabled={!row.on} onChange={(e) => setSize(size, { stock: e.target.value })} className={cn(inputClass, 'w-full')} placeholder="0" />
                {locked && form.sizes[size].stock !== String(existing.get(size)) && <span className="eyebrow shrink-0 text-gold">was {existing.get(size)}</span>}
              </li>
            );
          })}
        </ul>
        {err('sizes') && <p id={id('sizes-error')} className="mt-2 text-micro font-medium text-primary">{err('sizes')}</p>}
        <div className="mt-5 max-w-xs">
          <FormField label="Low-stock alert at" htmlFor={id('lowStockThreshold')} error={err('lowStockThreshold')} hint="Email admins when any size drops to this many units or fewer.">
            <input id={id('lowStockThreshold')} inputMode="numeric" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} className={inputClass} />
          </FormField>
        </div>
      </Panel>

      <Panel title="Details">
        <FormField label="Key features" htmlFor={id('feature-0')} hint="Short bullet points shown next to the price.">
          <ul className="space-y-2">
            {form.features.map((feature, i) => (
              <li key={i} className="flex gap-2">
                <input id={id(`feature-${i}`)} value={feature} aria-label={`Feature ${i + 1}`} onChange={(e) => set('features', form.features.map((f, j) => (j === i ? e.target.value : f)))} className={inputClass} />
                <button type="button" aria-label={`Remove feature ${i + 1}`} onClick={() => set('features', form.features.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center text-ink/50 hover:text-primary">
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => set('features', [...form.features, ''])} disabled={form.features.length >= 12}>
            <Plus aria-hidden className="size-3.5" /> Add feature
          </Button>
        </FormField>

        <div className="mt-6">
          <FormField label="Specifications" htmlFor={id('spec-0')} error={err('specs')} hint="Shown in “Details & care”: fabric, fit, care instructions…">
            <ul className="space-y-2">
              {form.specs.map((row, i) => (
                <li key={i} className="flex gap-2">
                  <input id={id(`spec-${i}`)} value={row.label} aria-label={`Specification ${i + 1} label`} placeholder="Fabric" onChange={(e) => set('specs', form.specs.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} className={cn(inputClass, 'max-w-40')} />
                  <input value={row.value} aria-label={`Specification ${i + 1} value`} placeholder="100% recycled polyester" onChange={(e) => set('specs', form.specs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} className={inputClass} />
                  <button type="button" aria-label={`Remove specification ${i + 1}`} onClick={() => set('specs', form.specs.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center text-ink/50 hover:text-primary">
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => set('specs', [...form.specs, { label: '', value: '' }])} disabled={form.specs.length >= 20}>
              <Plus aria-hidden className="size-3.5" /> Add row
            </Button>
          </FormField>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <FormField label="Tags" htmlFor={id('tags')} hint="Comma-separated, e.g. Home, 2026/27" className="sm:col-span-3">
            <input id={id('tags')} value={form.tags} onChange={(e) => set('tags', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Colour name" htmlFor={id('colorName')} hint="e.g. Home Red">
            <input id={id('colorName')} value={form.colorName} onChange={(e) => set('colorName', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Colour swatch" htmlFor={id('colorHex')} error={err('colorHex')}>
            <span className="flex gap-2">
              <input type="color" aria-label="Pick swatch colour" value={HEX.test(form.colorHex) ? form.colorHex : '#cccccc'} onChange={(e) => set('colorHex', e.target.value.toUpperCase())} className="h-10 w-12 shrink-0 cursor-pointer rounded-btn border border-line bg-white p-1" />
              <input id={id('colorHex')} value={form.colorHex} onChange={(e) => set('colorHex', e.target.value)} className={inputClass} placeholder="#EF0107" />
            </span>
          </FormField>
        </div>
      </Panel>

      <Panel title="On the storefront" description="Controls where this kit appears and whether customers can see it.">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Badge" htmlFor={id('badge')} hint="“New” feeds New Season and the hero; “Limited” feeds the Limited Edition banner.">
            <select id={id('badge')} value={form.badge} onChange={(e) => set('badge', e.target.value as FormState['badge'])} className={inputClass}>
              <option value="">None</option>
              <option value="NEW">New</option>
              <option value="LIMITED">Limited edition</option>
            </select>
          </FormField>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.isBestSeller} onChange={(e) => set('isBestSeller', e.target.checked)} className="size-4 accent-primary" /> Show in Best Sellers
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} className="size-4 accent-primary" /> Feature on the home page
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-4 accent-primary" /> Visible in the shop
          </label>
        </div>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 lg:px-6">
          <div className="min-w-0 flex-1 text-sm">{message ? <Alert tone={message.tone}>{message.text}</Alert> : <span className="text-muted">{editing ? 'Changes are saved when you press Save.' : 'The product is created when you press Create.'}</span>}</div>
          <div className="flex gap-3">
            <Button href="/admin/products" variant="secondary">
              {editing ? 'Back to products' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

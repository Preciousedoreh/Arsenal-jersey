'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, ConfirmDialog, FormField, PageHeader, Panel, Pill, Spinner, inputClass, textareaClass } from '@/components/admin/ui';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { Button } from '@/components/ui/Button';
import { adminApi, type CategoryInput } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type { ApiCategory } from '@/types/api';

type Editing = { mode: 'new' } | { mode: 'edit'; category: ApiCategory } | null;

const slugify = (v: string) => v.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/** Create, rename, reorder, hide and delete categories (the groups jerseys are filed under). */
export function CategoriesManager() {
  const [categories, setCategories] = useState<ApiCategory[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [toDelete, setToDelete] = useState<ApiCategory | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCategories((await adminApi.categories()).data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load categories.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await adminApi.deleteCategory(toDelete.id);
      setNotice(`“${toDelete.name}” was deleted.`);
      setError(null);
      await load();
    } catch (e) {
      // e.g. 409: the category still has products
      setError(e instanceof Error ? e.message : 'Could not delete.');
      setNotice(null);
    } finally {
      setToDelete(null);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="The groups your jerseys are filed under (Home Kits, Away Kits, Retro…). Customers browse the shop by category."
        actions={
          editing ? null : (
            <Button onClick={() => { setEditing({ mode: 'new' }); setNotice(null); setError(null); }}>
              <Plus aria-hidden className="size-4" /> Add category
            </Button>
          )
        }
      />

      <div className="mb-4 space-y-3">
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>

      {editing && (
        <CategoryForm
          key={editing.mode === 'edit' ? editing.category.id : 'new'}
          category={editing.mode === 'edit' ? editing.category : undefined}
          onCancel={() => setEditing(null)}
          onSaved={async (name) => {
            setEditing(null);
            setNotice(`“${name}” saved.`);
            await load();
          }}
        />
      )}

      {!categories ? (
        <Spinner label="Loading categories…" />
      ) : (
        <div className="mt-4 overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface">
                <th scope="col" className="eyebrow px-4 py-3">Category</th>
                <th scope="col" className="eyebrow px-4 py-3">Page address</th>
                <th scope="col" className="eyebrow px-4 py-3">Order</th>
                <th scope="col" className="eyebrow px-4 py-3">Products</th>
                <th scope="col" className="eyebrow px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-ink/60">
                    No categories yet. Add your first one to start filing jerseys.
                  </td>
                </tr>
              )}
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden bg-surface">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt="" className="size-full object-cover" />
                        ) : null}
                      </span>
                      <span className="font-semibold">{c.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/60">/category/{c.slug}</td>
                  <td className="px-4 py-3 tabular-nums">{c.sortOrder}</td>
                  <td className="px-4 py-3 tabular-nums">{c.productCount}</td>
                  <td className="px-4 py-3">{c.isActive ? <Pill tone="green">Visible</Pill> : <Pill tone="gold">Hidden</Pill>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => { setEditing({ mode: 'edit', category: c }); setNotice(null); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={`Edit ${c.name}`} className="grid size-9 place-items-center text-ink/60 hover:text-ink">
                        <Pencil aria-hidden className="size-4" />
                      </button>
                      <button type="button" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`} className="grid size-9 place-items-center text-ink/60 hover:text-primary">
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this category?"
        message={
          toDelete && toDelete.productCount > 0 ? (
            <>
              <strong>{toDelete.name}</strong> still has {toDelete.productCount} product(s), so it can’t be deleted. Move them to another category first, or hide the category instead.
            </>
          ) : (
            <>
              <strong>{toDelete?.name}</strong> will be removed. This can’t be undone.
            </>
          )
        }
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function CategoryForm({ category, onCancel, onSaved }: { category?: ApiCategory; onCancel: () => void; onSaved: (name: string) => void }) {
  const uid = useId();
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [images, setImages] = useState<string[]>(category?.imageUrl ? [category.imageUrl] : []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Enter a name (at least 2 characters).');
    if (!/^-?\d+$/.test(sortOrder.trim())) return setError('Order must be a whole number.');
    const body: CategoryInput = { name: name.trim(), description: description.trim(), imageUrl: images[0] ?? null, sortOrder: Number(sortOrder), isActive, ...(slug ? { slug } : {}) };
    setBusy(true);
    try {
      if (category) await adminApi.updateCategory(category.id, body);
      else await adminApi.createCategory(body);
      onSaved(body.name);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'SLUG_TAKEN' ? 'That page address is already used by another category.' : err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={category ? `Edit “${category.name}”` : 'New category'}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor={`${uid}-name`}>
            <input
              id={`${uid}-name`} value={name} className={inputClass} placeholder="e.g. Home Kits" autoFocus
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </FormField>
          <FormField label="Page address (slug)" htmlFor={`${uid}-slug`} hint={`/category/${slug || '…'}`}>
            <input id={`${uid}-slug`} value={slug} className={inputClass} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} />
          </FormField>
          <FormField label="Description" htmlFor={`${uid}-desc`} className="sm:col-span-2">
            <textarea id={`${uid}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} rows={2} />
          </FormField>
          <FormField label="Display order" htmlFor={`${uid}-order`} hint="Lower numbers come first.">
            <input id={`${uid}-order`} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} />
          </FormField>
          <label className="flex cursor-pointer items-center gap-2.5 self-end pb-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 accent-primary" /> Visible in the shop
          </label>
        </div>
        <div>
          <p className="eyebrow mb-2 text-ink/70">Photo (shown on the home page tile)</p>
          <ImageUploader images={images} onChange={setImages} max={1} slotLabels={[]} />
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : category ? 'Save category' : 'Create category'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

'use client';

import { useRef } from 'react';
import { Ruler, X } from 'lucide-react';
import { sizeChart } from '@/data/size-chart';

/** "Size guide" link that opens a native modal <dialog> (focus trap, Esc to close, backdrop click). */
export function SizeGuide() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="eyebrow inline-flex items-center gap-1.5 text-ink underline underline-offset-4 transition-colors hover:text-primary"
      >
        <Ruler aria-hidden className="size-3.5" />
        Size guide
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="size-guide-title"
        // The dialog has no padding of its own, so a click whose target is the dialog itself hit the backdrop.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(92vw,34rem)] border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/60"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id="size-guide-title" className="headline text-3xl">
              Size guide
            </h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close size guide" className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-ink/70">Measurements are of the shirt laid flat. Compare with a shirt that fits you well.</p>

          <table className="mt-6 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="eyebrow py-2 pr-3">Size</th>
                <th scope="col" className="eyebrow py-2 pr-3">Chest (cm)</th>
                <th scope="col" className="eyebrow py-2 pr-3">Chest (in)</th>
                <th scope="col" className="eyebrow py-2">Length (cm)</th>
              </tr>
            </thead>
            <tbody>
              {sizeChart.map((row) => (
                <tr key={row.size} className="border-b border-line">
                  <th scope="row" className="py-2.5 pr-3 font-bold">{row.size}</th>
                  <td className="py-2.5 pr-3 tabular-nums">{row.chestCm}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{row.chestIn}</td>
                  <td className="py-2.5 tabular-nums">{row.lengthCm}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="mt-6 space-y-2 text-micro text-ink/70">
            <li>Match shirts have a regular fit. Between sizes? Go up for a relaxed fit.</li>
            <li>The Retro 1989 shirt is cut relaxed — size down for a closer fit.</li>
          </ul>
        </div>
      </dialog>
    </>
  );
}

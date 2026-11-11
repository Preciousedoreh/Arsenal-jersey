/** White card with a numbered display heading ("1. CONTACT") and an optional note on the right. */
export function CheckoutSection({
  step,
  title,
  aside,
  children,
}: {
  step: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const headingId = `checkout-section-${step}`;
  return (
    <section aria-labelledby={headingId} className="border border-line bg-white p-6 sm:p-7">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="headline text-2xl">
          {step}. {title}
        </h2>
        {aside && <div className="text-micro text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

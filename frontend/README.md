# REDLINE — Kit Store Frontend

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4 · framer-motion · Zustand · lucide-react.

The storefront and the admin read and write real data through the store API in `../` (products, categories, stock, photo uploads).

## Run it

You need the API running first (it needs Postgres and Redis from `docker compose up -d` in the repo root):

```bash
# 1. repo root — API on http://localhost:4000
docker compose up -d
npm install && npm run db:deploy && npm run db:seed
npm run dev

# 2. this folder — storefront + admin on http://localhost:3000
cd frontend
npm install
npm run dev
```

| URL | What |
| --- | --- |
| http://localhost:3000 | The shop |
| http://localhost:3000/admin | The admin (sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the API's `.env`) |

Settings (see `.env.example`): `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) and `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`). Production: `npm run build && npm start`. Checks: `npm run typecheck`, `npm run lint`.

> Storefront pages cache API responses for 30 seconds, so a catalogue change in the admin can take up to half a minute to appear on the public site.

## The admin (`/admin`)

Sign in with an account that has the `ADMIN` role. The API enforces the role on every request; the screens just show or hide things accordingly.

| Screen | What you can do |
| --- | --- |
| **Dashboard** | Stock overview (products, units, sizes running low / sold out, units sold) and a "Needs restocking" table with a one-step **add stock** box |
| **Products** | Search and filter, show/hide, delete (products with orders are archived instead). **Add product** / edit opens the full form below |
| **Categories** | Create, rename, reorder, hide and delete the categories jerseys are filed under (with a photo for the home-page tile). A category with products can't be deleted |

**Add / edit product form:** name, slug, SKU, category, subtitle, description · **photos** (upload from your computer or paste a link; reorder them — the first three are Front, Back and Detail on the product page) · price, and optional name & number printing with its own price and lettering colour · **sizes and opening stock** (S–XXL, or "one size" for non-apparel) · features, specs and tags · badge, "Best seller" / "Featured" flags, colour and visibility. After a product exists, changing a size's stock number records an entry in the stock history.

What appears where on the home page is controlled from the product form: the **New** badge feeds *New Season* and the hero, **Show in Best Sellers** feeds *Best Sellers*, **Feature on the home page** leads the inline product block, and the **Limited** badge feeds the *Limited Edition* banner. Categories with at least one visible product get a tile, a menu link and a page at `/category/<slug>`.

## Storefront pages

| Route | |
| --- | --- |
| `/` | Home (sections above, plus hero, craft strip, customizer, reviews, newsletter) |
| `/shop`, `/category/[slug]` | All kits / one category, with category filter chips |
| `/products/[slug]` | Product page (below) |
| `/checkout` | Checkout (own layout, no site navigation) |

### Product page

- **Gallery:** the product's photos with arrows, thumbnails, swipe, ←/→ keys and hover zoom. The live name & number preview is drawn on the back view of the bundled placeholder art; real photos show without the overlay.
- **Buying panel:** per-size availability (sold-out sizes are struck through and disabled, "Only N left" for the chosen size), size guide dialog, optional name & number printing with a live total, quantity (capped at that size's stock), "Add to cart" and "Buy it now". A size must be chosen first, and a mobile sticky bar keeps the buy button within reach.
- **Below:** details & delivery, a rating breakdown (shown only when a product has ratings), and related kits.

## Checkout (`/checkout`)

Sections: contact, shipping address, delivery, payment (card / PayPal / Apple Pay), plus a sticky order summary with editable quantities. Validation runs on submit and then live; card numbers get a Luhn check.

**Delivery pricing:** Standard is free from $100 and $6 below that; Express $12; Next day $22 (`deliveryOptions` in `lib/checkout.ts`).

**Placing an order is still simulated** — "Place order" waits ~1.4s and shows a confirmation; nothing is sent to the API yet. Real card capture must use the payment provider's hosted fields, never raw inputs like these. To go live, replace the simulated delay in `components/checkout/CheckoutExperience.tsx` with:

1. Customer sign-in / registration screens (the API requires a **verified, signed-in** customer to order).
2. `POST /api/orders` with `{ items: [{ productId, size, quantity, customization? }], shippingAddress }`. Cart lines already carry the API's `productId`, `size` and print. The API's shipping address also requires a two-letter **`country`**, which this form doesn't collect yet.
3. `POST /api/orders/:id/pay`, then hand off to the provider.

## How it's built

- **Data:** `lib/api.ts` (fetch wrapper), `lib/catalog.ts` (storefront fetching + the cents → dollars conversion), `lib/admin-api.ts` (typed admin calls), `types/api.ts` (API shapes). The storefront pages render per request and the API responses are cached for 30s.
- **Server Components by default.** Client components are only the interactive parts: hero carousel, countdowns, customizer, product panel, cards, testimonials, newsletter, navbar/drawer, checkout, and the whole admin.
- **Cart:** Zustand store persisted to `localStorage` (`lib/cart-store.ts`). Lines are per product + size + colour + print.
- **Placeholder art:** `public/images/*.svg` are original illustrations (generic red/white/gold kits, stadiums, players) made by `npm run images`. The API's seed points its starter products at them. Real photos uploaded in the admin are served by the API from `/uploads`. Only use club crests, sponsor marks and player images you have the rights to.
- **Brand:** name, tagline and navigation in `lib/site.ts`; logo/crest placeholder in `components/ui/Brand.tsx`; colours and fonts in the `@theme` block of `app/globals.css`.
- **Accessibility:** landmarks, a skip link, visible focus rings, labelled icon buttons, keyboard-operable carousels and dialogs, announced form errors, and `prefers-reduced-motion` respected.

```
app/(shop)/         home, /shop, /category/[slug], /products/[slug]   (navbar + footer layout)
app/(checkout)/     /checkout                                         (slim secure layout)
app/(admin)/        /admin, /admin/login, products, categories        (admin shell)
components/layout/  AnnouncementBar, Navbar, MobileMenu, Footer
components/sections Hero, FeaturedKits, NewCollection, CategoryGrid, FeaturedProduct, BestSellers, …
components/product/ ProductDetail, ProductGallery, SizeGuide, ProductGrid, reviews, related
components/checkout/ checkout form, summary, confirmation
components/admin/   AdminShell, ProductForm, ImageUploader, ProductsList, CategoriesManager, Dashboard
components/ui/      Button, Badge, ProductCard, Countdown, StarRating, …
lib/                api, catalog, admin-api, cart-store, checkout rules, site config, utils
types/              storefront types and API shapes
```

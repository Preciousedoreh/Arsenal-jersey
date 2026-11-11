/**
 * Generates the placeholder artwork in /public/images (run: `npm run images`).
 *
 * Everything here is original vector art — generic red/white/gold kits, stylised stadiums and
 * players — so the site looks finished without using any club crest, sponsor or player likeness.
 * Swap any file for your own licensed photography (keep the name, or update data/images.ts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/images/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const C = {
  red: '#EF0107',
  redDeep: '#A80005',
  redDark: '#5C0003',
  white: '#FFFFFF',
  cream: '#F4F1EA',
  gold: '#9C824A',
  goldLight: '#D6B66E',
  ink: '#120A0B',
  black: '#0E0C0D',
  navy: '#063672',
};

const save = (name, svg) => writeFileSync(OUT + name, svg.trim() + '\n');
let uid = 0;
const id = (p) => `${p}${++uid}`;

// ───────────────────────────── Kits ─────────────────────────────

const BODY =
  'M155 30 Q200 64 245 30 L288 41 L300 46 L372 122 L334 164 L296 138 L294 404 Q200 420 106 404 L104 138 L66 164 L28 122 L100 46 L112 41 Z';
const SLEEVE_R = 'M288 41 L300 46 L372 122 L334 164 L296 138 Q298 88 288 41 Z';
const SLEEVE_L = 'M112 41 L100 46 L28 122 L66 164 L104 138 Q102 88 112 41 Z';
const SHIELD = 'M0 0 H26 V13 Q26 26 13 33 Q0 26 0 13 Z';

/**
 * A shirt in a 400×440 box. `back` draws the rear view (no crest, shallow collar).
 * `name`/`number` print onto the back (used for the matchday player art).
 */
function shirt(k, { back = false, name, number } = {}) {
  const clip = id('clip');
  const shade = id('shade');
  const sheen = id('sheen');
  const pattern =
    k.pattern === 'pinstripe'
      ? Array.from({ length: 22 }, (_, i) => `<line x1="${60 + i * 14}" y1="20" x2="${60 + i * 14}" y2="430" stroke="${k.accent}" stroke-width="1.6" opacity=".55"/>`).join('')
      : k.pattern === 'chevron'
        ? Array.from({ length: 9 }, (_, i) => `<path d="M90 ${150 + i * 28} L200 ${205 + i * 28} L310 ${150 + i * 28}" fill="none" stroke="${k.accent}" stroke-width="7" opacity=".35"/>`).join('')
        : k.pattern === 'sash'
          ? `<path d="M90 300 L330 60 L360 90 L120 330 Z" fill="${k.accent}" opacity=".9"/>`
          : k.pattern === 'panel'
            ? `<rect x="104" y="150" width="14" height="260" fill="${k.accent}"/><rect x="282" y="150" width="14" height="260" fill="${k.accent}"/>`
            : '';
  const collar = back ? 'M158 30 Q200 46 242 30' : 'M155 30 Q200 64 245 30';
  const front = back
    ? `<path d="M186 40 Q200 46 214 40" stroke="${k.accent}" stroke-width="2" fill="none"/>`
    : `<g transform="translate(234 96)"><path d="${SHIELD}" fill="${k.crest}"/><path d="${SHIELD}" transform="translate(4 4) scale(.69)" fill="none" stroke="${k.body}" stroke-width="2"/></g>
       <path d="M144 106 l9 9 l14 -16" stroke="${k.trim}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const lettering =
    back && (name || number)
      ? `<text x="200" y="128" text-anchor="middle" font-family="Impact, 'Arial Narrow', sans-serif" font-size="34" letter-spacing="3" fill="${k.trim}">${name ?? ''}</text>
         <text x="200" y="290" text-anchor="middle" font-family="Impact, 'Arial Narrow', sans-serif" font-size="150" fill="${k.trim}">${number ?? ''}</text>`
      : '';
  return `
  <defs>
    <clipPath id="${clip}"><path d="${BODY}"/></clipPath>
    <linearGradient id="${shade}" x1="0" x2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".22" stop-color="#000" stop-opacity=".04"/>
      <stop offset=".38" stop-color="#fff" stop-opacity=".16"/><stop offset=".62" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".3"/>
    </linearGradient>
    <linearGradient id="${sheen}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".18"/>
    </linearGradient>
  </defs>
  <ellipse cx="200" cy="424" rx="150" ry="10" fill="#000" opacity=".12"/>
  <path d="${BODY}" fill="${k.body}"/>
  <g clip-path="url(#${clip})">
    ${pattern}
    <path d="${SLEEVE_R}" fill="${k.sleeves}"/><path d="${SLEEVE_L}" fill="${k.sleeves}"/>
    <path d="M362 111 L324 153" stroke="${k.trim}" stroke-width="9"/><path d="M38 111 L76 153" stroke="${k.trim}" stroke-width="9"/>
    <path d="M296 138 Q298 88 288 41" stroke="${k.accent}" stroke-width="2.5" fill="none"/><path d="M104 138 Q102 88 112 41" stroke="${k.accent}" stroke-width="2.5" fill="none"/>
    <path d="M106 398 Q200 414 294 398" stroke="${k.trim}" stroke-width="6" fill="none" opacity=".9"/>
    <path d="M150 190 q24 70 -4 170 M250 210 q-18 60 6 150 M200 300 q10 40 -6 90" stroke="#000" stroke-width="10" fill="none" opacity=".06" stroke-linecap="round"/>
    <rect width="400" height="440" fill="url(#${shade})"/><rect width="400" height="440" fill="url(#${sheen})"/>
  </g>
  <path d="${collar}" stroke="${k.trim}" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="${collar}" stroke="${k.accent}" stroke-width="2.5" fill="none" transform="translate(0 6)" opacity=".9"/>
  ${front}
  ${lettering}`;
}

/** `view` is the SVG viewBox: the default shows the whole shirt, a smaller box zooms into a detail. */
const kitSvg = (k, opts, view = [0, 0, 400, 440]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.join(' ')}" width="800" height="${Math.round((800 * view[3]) / view[2])}">${shirt(k, opts)}</svg>`;

const KITS = {
  'home-26': { body: C.red, sleeves: C.white, trim: C.white, accent: C.goldLight, crest: C.goldLight },
  'away-26': { body: C.cream, sleeves: C.cream, trim: C.red, accent: C.gold, crest: C.gold, pattern: 'panel' },
  'third-26': { body: C.black, sleeves: C.black, trim: C.goldLight, accent: C.gold, crest: C.goldLight, pattern: 'chevron' },
  'retro-89': { body: C.red, sleeves: C.white, trim: C.white, accent: C.redDeep, crest: C.white, pattern: 'chevron' },
  'training-top': { body: C.redDeep, sleeves: C.black, trim: C.white, accent: C.black, crest: C.white, pattern: 'sash' },
  'pre-match': { body: C.white, sleeves: C.red, trim: C.red, accent: C.red, crest: C.gold, pattern: 'chevron' },
  'limited-edition': { body: C.black, sleeves: C.black, trim: C.goldLight, accent: C.gold, crest: C.goldLight, pattern: 'pinstripe' },
};
for (const [name, k] of Object.entries(KITS)) save(`kit-${name}.svg`, kitSvg(k));

// Product-page gallery: a back view (no pattern, so the live name & number print stays legible)
// and a close-up of the collar, crest and chest mark.
for (const [name, k] of Object.entries(KITS)) {
  save(`kit-${name}-back.svg`, kitSvg({ ...k, pattern: undefined }, { back: true }));
  save(`kit-${name}-detail.svg`, kitSvg(k, {}, [110, 10, 200, 220]));
}

// Back views for the customizer (name/number are overlaid live in the browser).
save('kit-back-red.svg', kitSvg(KITS['home-26'], { back: true }));
save('kit-back-white.svg', kitSvg({ ...KITS['away-26'], pattern: undefined }, { back: true }));
save('kit-back-black.svg', kitSvg({ ...KITS['third-26'], pattern: undefined }, { back: true }));

// ───────────────────────────── Scenes ─────────────────────────────

/** Stylised stadium: sky, roof, floodlights, stands with crowd, striped pitch. */
function stadium(w, h, mode) {
  const dark = mode === 'dark';
  const sky = id('sky');
  const crowd = id('crowd');
  const glow = id('glow');
  const pitch = id('pitch');
  const horizon = h * 0.62;
  const lights = [w * 0.12, w * 0.88]
    .map(
      (x) => `
      <rect x="${x - 4}" y="${h * 0.08}" width="8" height="${horizon - h * 0.08}" fill="${dark ? '#2a2224' : '#b9bcc2'}"/>
      <rect x="${x - 46}" y="${h * 0.05}" width="92" height="44" rx="3" fill="${dark ? '#3a3133' : '#cfd2d6'}"/>
      ${Array.from({ length: 12 }, (_, i) => `<circle cx="${x - 36 + (i % 6) * 14.5}" cy="${h * 0.05 + 13 + Math.floor(i / 6) * 17}" r="5" fill="${dark ? '#fff6dc' : '#ffffff'}"/>`).join('')}
      <circle cx="${x}" cy="${h * 0.05 + 22}" r="${dark ? 150 : 90}" fill="url(#${glow})"/>`,
    )
    .join('');
  const stripes = Array.from({ length: 9 }, (_, i) => {
    const y0 = horizon + ((h - horizon) * i) / 9;
    const y1 = horizon + ((h - horizon) * (i + 1)) / 9;
    return i % 2 ? `<rect x="0" y="${y0}" width="${w}" height="${y1 - y0}" fill="#000" opacity="${dark ? 0.12 : 0.05}"/>` : '';
  }).join('');
  return `
  <defs>
    <linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1">
      ${dark ? '<stop offset="0" stop-color="#07090f"/><stop offset=".6" stop-color="#1c1416"/><stop offset="1" stop-color="#2a1416"/>' : '<stop offset="0" stop-color="#e9eaed"/><stop offset="1" stop-color="#f7f7f8"/>'}
    </linearGradient>
    <pattern id="${crowd}" width="9" height="8" patternUnits="userSpaceOnUse">
      <rect width="9" height="8" fill="${dark ? '#1b1416' : '#c9ccd1'}"/>
      <circle cx="3" cy="3" r="2.1" fill="${dark ? '#4a2a2d' : '#e3e5e8'}"/><circle cx="7.5" cy="6" r="1.8" fill="${dark ? '#8a1d22' : '#b5b9bf'}"/>
    </pattern>
    <radialGradient id="${glow}"><stop offset="0" stop-color="#fff" stop-opacity="${dark ? 0.55 : 0.8}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${pitch}" x1="0" y1="0" x2="0" y2="1">
      ${dark ? '<stop offset="0" stop-color="#1f3a22"/><stop offset="1" stop-color="#0e1a10"/>' : '<stop offset="0" stop-color="#d9dcd9"/><stop offset="1" stop-color="#eceeec"/>'}
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${sky})"/>
  <path d="M0 ${h * 0.2} L${w} ${h * 0.12} L${w} ${h * 0.2} L0 ${h * 0.27} Z" fill="${dark ? '#0b0809' : '#d5d7db'}"/>
  ${Array.from({ length: 16 }, (_, i) => `<line x1="${(w / 16) * i}" y1="${h * 0.26 - i * (h * 0.0045)}" x2="${(w / 16) * i + 30}" y2="${horizon}" stroke="${dark ? '#000' : '#bfc2c7'}" stroke-width="3" opacity=".5"/>`).join('')}
  <path d="M0 ${h * 0.27} L${w} ${h * 0.2} L${w} ${horizon} L0 ${horizon} Z" fill="url(#${crowd})"/>
  <rect x="0" y="${h * 0.43}" width="${w}" height="10" fill="${dark ? C.redDeep : '#d0d2d6'}" opacity=".85"/>
  <rect x="0" y="${horizon - 18}" width="${w}" height="18" fill="${dark ? C.red : '#e4e5e8'}" opacity="${dark ? 0.7 : 1}"/>
  ${lights}
  <rect x="0" y="${horizon}" width="${w}" height="${h - horizon}" fill="url(#${pitch})"/>
  ${stripes}
  <path d="M${w * 0.5} ${horizon} L${w * 0.5} ${h}" stroke="#fff" stroke-width="3" opacity="${dark ? 0.25 : 0.6}"/>
  <ellipse cx="${w * 0.5}" cy="${horizon + (h - horizon) * 0.55}" rx="${w * 0.16}" ry="${(h - horizon) * 0.25}" fill="none" stroke="#fff" stroke-width="3" opacity="${dark ? 0.2 : 0.5}"/>`;
}

const SKIN = ['#8d5a3c', '#c58c63', '#5e3b28', '#e0b08a', '#a8714d', '#3f271b'];

/**
 * Chest-up player in a kit, centred on (cx, baseY) and `s` scale. `back` turns them around
 * (for the name & number shot). Built from the same shirt geometry as the product art.
 */
function player(cx, baseY, s, k, { skin = SKIN[0], back = false, name, number, hair = '#140c08', long = false } = {}) {
  const head = back
    ? `<ellipse cx="200" cy="-34" rx="48" ry="56" fill="${hair}"/>`
    : `<ellipse cx="200" cy="-34" rx="46" ry="56" fill="${skin}"/>
       <path d="M154 -52 Q160 -100 200 -98 Q242 -100 246 -52 Q236 -74 200 -76 Q166 -74 154 -52 Z" fill="${hair}"/>
       <ellipse cx="183" cy="-36" rx="5" ry="3.5" fill="#1a0f0a" opacity=".8"/><ellipse cx="217" cy="-36" rx="5" ry="3.5" fill="#1a0f0a" opacity=".8"/>
       <path d="M188 -8 Q200 -2 212 -8" stroke="#1a0f0a" stroke-width="3" fill="none" opacity=".55"/>`;
  const hairLong = long ? `<path d="M150 -60 Q140 20 160 40 L170 -20 Z M250 -60 Q260 20 240 40 L230 -20 Z" fill="${hair}"/>` : '';
  return `
  <g transform="translate(${cx - 200 * s} ${baseY - 404 * s}) scale(${s})">
    <path d="M60 170 Q30 300 44 404 L96 404 Q92 300 108 180 Z M340 170 Q370 300 356 404 L304 404 Q308 300 292 180 Z" fill="${skin}"/>
    <rect x="178" y="-6" width="44" height="50" rx="16" fill="${skin}"/>
    ${hairLong}
    ${head}
    <g transform="translate(200 0) scale(1.18 1) translate(-200 0)">${shirt(k, { back, name, number })}</g>
  </g>`;
}

function scene(w, h, mode, inner, { vignette = true, tint } = {}) {
  const v = id('vig');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
  ${stadium(w, h, mode)}
  ${tint ? `<rect width="${w}" height="${h}" fill="${tint}" opacity=".18"/>` : ''}
  ${inner}
  ${vignette ? `<defs><radialGradient id="${v}" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${mode === 'dark' ? 0.65 : 0.12}"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#${v})"/>` : ''}
</svg>`;
}

save('hero-stadium.svg', scene(1600, 900, 'light', '', { vignette: false }));
save('newsletter-stadium.svg', scene(900, 600, 'light', ''));

save('matchday-player.svg', scene(1600, 700, 'dark', player(1120, 760, 1.55, KITS['home-26'], { back: true, name: 'GUNNER', number: '14' }), { tint: C.red }));
save('moment-player.svg', scene(1600, 700, 'dark', player(1100, 760, 1.5, KITS['home-26'], { skin: SKIN[2] })));

const CATEGORY_PLAYERS = {
  'home-kits': [KITS['home-26'], { skin: SKIN[0] }],
  'away-kits': [KITS['away-26'], { skin: SKIN[1] }],
  'third-kits': [KITS['third-26'], { skin: SKIN[2] }],
  retro: [KITS['retro-89'], { skin: SKIN[3], hair: '#5a3a1c' }],
  training: [KITS['training-top'], { skin: SKIN[4] }],
  'women-kids': [KITS['pre-match'], { skin: SKIN[5], long: true }],
};
for (const [slug, [kit, opts]] of Object.entries(CATEGORY_PLAYERS)) {
  save(`category-${slug}.svg`, scene(600, 800, 'dark', player(300, 900, 1.22, kit, opts)));
}

// ───────────────────────────── Craft textures ─────────────────────────────

function craft(name, body) {
  save(`craft-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420" preserveAspectRatio="xMidYMid slice">${body}</svg>`);
}

craft(
  'fabric',
  `<defs>
    <pattern id="mesh" width="14" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
      <rect width="14" height="12" fill="${C.red}"/><ellipse cx="7" cy="6" rx="3.2" ry="2.4" fill="${C.redDark}" opacity=".75"/>
    </pattern>
    <linearGradient id="fl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
  </defs>
  <rect width="800" height="420" fill="url(#mesh)"/>
  <path d="M0 260 Q200 180 420 250 T800 210 V420 H0 Z" fill="#000" opacity=".18"/>
  <path d="M0 120 Q260 40 520 120 T800 90" stroke="#fff" stroke-width="40" opacity=".08" fill="none"/>
  <rect width="800" height="420" fill="url(#fl)"/>`,
);

craft(
  'badge',
  `<defs>
    <pattern id="knit" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#1a1314"/><path d="M0 3 H6" stroke="#2a2022" stroke-width="2"/></pattern>
    <radialGradient id="bl" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.goldLight}"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="#6b5730"/></linearGradient>
  </defs>
  <rect width="800" height="420" fill="url(#knit)"/>
  <g transform="translate(400 210) rotate(-6) scale(5.2) translate(-13 -17)">
    <path d="${SHIELD}" fill="url(#gold)"/>
    <path d="${SHIELD}" transform="translate(3.5 3.5) scale(.73)" fill="#1a1314"/>
    <path d="M13 9 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7 Z" fill="url(#gold)"/>
  </g>
  <rect width="800" height="420" fill="url(#bl)"/>`,
);

craft(
  'stitching',
  `<defs>
    <pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <rect width="8" height="8" fill="#e9e6df"/><path d="M0 4 H8" stroke="#d6d1c6" stroke-width="2"/><path d="M4 0 V8" stroke="#dcd7cc" stroke-width="1"/>
    </pattern>
    <linearGradient id="sl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
  </defs>
  <rect width="800" height="420" fill="url(#weave)"/>
  <path d="M-20 300 L820 120 L820 180 L-20 360 Z" fill="${C.red}"/>
  <path d="M-20 290 L820 110" stroke="${C.gold}" stroke-width="5" stroke-dasharray="16 10"/>
  <path d="M-20 372 L820 192" stroke="${C.gold}" stroke-width="5" stroke-dasharray="16 10"/>
  <path d="M-20 318 L820 138" stroke="#fff" stroke-width="2" stroke-dasharray="8 8" opacity=".7"/>
  <rect width="800" height="420" fill="url(#sl)"/>`,
);

// ───────────────────────────── Divider strip & avatars ─────────────────────────────

save(
  'divider-flag.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 260" width="2400" height="260" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="dl" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs>
  <rect width="2400" height="260" fill="${C.redDeep}"/>
  <path d="M0 60 Q600 -10 1200 70 T2400 50 V130 Q1800 170 1200 120 T0 150 Z" fill="${C.red}"/>
  <path d="M0 150 Q600 120 1200 190 T2400 140 V200 Q1800 240 1200 210 T0 230 Z" fill="${C.white}"/>
  <path d="M0 140 Q600 110 1200 180 T2400 130" stroke="${C.goldLight}" stroke-width="10" fill="none"/>
  <path d="M0 40 Q700 120 1400 30 T2400 90" stroke="#000" stroke-width="60" fill="none" opacity=".12"/>
  <rect width="2400" height="260" fill="url(#dl)"/>
</svg>`,
);

const AVATAR_BG = [C.red, C.gold, C.navy, C.redDeep, '#3a3a3a', C.goldLight];
AVATAR_BG.forEach((bg, i) => {
  save(
    `avatar-${i + 1}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="192" height="192">
  <rect width="96" height="96" fill="${bg}"/>
  <circle cx="48" cy="40" r="18" fill="${SKIN[i % SKIN.length]}"/>
  <path d="M30 34 Q32 18 48 18 Q64 18 66 34 Q58 26 48 26 Q38 26 30 34 Z" fill="#160d08"/>
  <path d="M14 96 Q16 66 48 64 Q80 66 82 96 Z" fill="${i % 2 ? C.white : C.ink}"/>
</svg>`,
  );
});

console.log('placeholder images written to public/images');

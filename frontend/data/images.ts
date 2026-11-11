/**
 * Every image path used by the site. To use your own photography, drop files into
 * /public/images and change the paths here (e.g. '/images/kit-home-26.webp').
 */
export const images = {
  kits: {
    home: '/images/kit-home-26.svg',
    away: '/images/kit-away-26.svg',
    third: '/images/kit-third-26.svg',
    retro: '/images/kit-retro-89.svg',
    training: '/images/kit-training-top.svg',
    preMatch: '/images/kit-pre-match.svg',
    limited: '/images/kit-limited-edition.svg',
  },
  kitBacks: {
    red: '/images/kit-back-red.svg',
    white: '/images/kit-back-white.svg',
    black: '/images/kit-back-black.svg',
  },
  scenes: {
    hero: '/images/hero-stadium.svg',
    matchday: '/images/matchday-player.svg',
    moment: '/images/moment-player.svg',
    newsletter: '/images/newsletter-stadium.svg',
    divider: '/images/divider-flag.svg',
  },
  categories: {
    home: '/images/category-home-kits.svg',
    away: '/images/category-away-kits.svg',
    third: '/images/category-third-kits.svg',
    retro: '/images/category-retro.svg',
    training: '/images/category-training.svg',
    womenKids: '/images/category-women-kids.svg',
  },
  craft: {
    fabric: '/images/craft-fabric.svg',
    badge: '/images/craft-badge.svg',
    stitching: '/images/craft-stitching.svg',
  },
  avatars: [
    '/images/avatar-1.svg',
    '/images/avatar-2.svg',
    '/images/avatar-3.svg',
    '/images/avatar-4.svg',
    '/images/avatar-5.svg',
    '/images/avatar-6.svg',
  ],
} as const;

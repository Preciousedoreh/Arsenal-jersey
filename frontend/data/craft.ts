import { images } from './images';

/** The three tiles of the craft strip. */
export const craftTiles = [
  { label: 'Premium Fabric', image: images.craft.fabric, alt: 'Close-up of breathable red mesh fabric' },
  { label: 'Official Badges', image: images.craft.badge, alt: 'Embossed gold crest on a dark knitted shirt' },
  { label: 'Precision Stitching', image: images.craft.stitching, alt: 'Gold stitching along a red shirt seam' },
] as const;

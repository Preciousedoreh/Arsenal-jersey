import Image from 'next/image';
import { images } from '@/data/images';

/** Decorative full-bleed fabric/flag strip that separates the light and dark halves of the page. */
export function DividerStrip() {
  return (
    <div aria-hidden className="relative h-24 overflow-hidden md:h-32">
      <Image src={images.scenes.divider} alt="" fill sizes="100vw" className="object-cover" />
    </div>
  );
}

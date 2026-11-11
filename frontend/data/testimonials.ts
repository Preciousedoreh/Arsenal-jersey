import type { Testimonial } from '@/types';
import { images } from './images';

export const testimonials: Testimonial[] = [
  { id: 't1', quote: 'The quality feels exactly like a matchday kit. Colours are spot on.', name: 'James T.', avatar: images.avatars[0], rating: 5 },
  { id: 't2', quote: 'Fast delivery and amazing customer service. Printing is flawless.', name: 'Daniel K.', avatar: images.avatars[1], rating: 5 },
  { id: 't3', quote: 'Best jersey store around. Will definitely order again.', name: 'Sophia L.', avatar: images.avatars[2], rating: 5 },
  { id: 't4', quote: 'The retro shirt took me straight back to the terraces. Love it.', name: 'Marcus O.', avatar: images.avatars[3], rating: 5 },
  { id: 't5', quote: 'Customised my son’s name and number — he hasn’t taken it off.', name: 'Aisha B.', avatar: images.avatars[4], rating: 5 },
  { id: 't6', quote: 'Black and gold limited edition is unreal in person.', name: 'Chris P.', avatar: images.avatars[5], rating: 5 },
];

import type { Size } from '@/types';

/** Shirt measurements (laid flat, body only). Sizes match Product.sizes. */
export interface SizeRow {
  size: Size;
  chestCm: string;
  chestIn: string;
  lengthCm: string;
}

export const sizeChart: SizeRow[] = [
  { size: 'S', chestCm: '92–97', chestIn: '36–38', lengthCm: '70' },
  { size: 'M', chestCm: '97–102', chestIn: '38–40', lengthCm: '72' },
  { size: 'L', chestCm: '102–107', chestIn: '40–42', lengthCm: '74' },
  { size: 'XL', chestCm: '107–112', chestIn: '42–44', lengthCm: '76' },
  { size: 'XXL', chestCm: '112–117', chestIn: '44–46', lengthCm: '78' },
];

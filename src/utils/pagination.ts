import { z } from 'zod';

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PageInfo;
}

export const skipTake = ({ page, pageSize }: PaginationQuery) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

export function paginated<T>(
  data: T[],
  total: number,
  { page, pageSize }: PaginationQuery,
): Paginated<T> {
  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

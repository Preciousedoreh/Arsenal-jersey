import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';

export const roleSchema = z.enum(['CUSTOMER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const updateMeBody = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    image: z
      .url({ protocol: /^https?$/ })
      .max(2048)
      .nullable()
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Provide at least one field to update');
export type UpdateMeInput = z.infer<typeof updateMeBody>;

export const userIdParams = z.object({ id: z.string().min(1).max(64) });

export const listUsersQuery = paginationQuery.extend({
  role: roleSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuery>;

export const updateRoleBody = z.strictObject({ role: roleSchema });

export interface UserDto {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
}

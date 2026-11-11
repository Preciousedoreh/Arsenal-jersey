import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { paginated, skipTake, type Paginated } from '../../utils/pagination.js';
import type { ListUsersQuery, Role, UpdateMeInput, UserDto } from './users.schemas.js';

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt.toISOString(),
  };
}

export const userService = {
  async getMe(id: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User');
    return toUserDto(user);
  },

  async updateMe(id: string, input: UpdateMeInput): Promise<UserDto> {
    return toUserDto(await prisma.user.update({ where: { id }, data: input }));
  },

  async list(q: ListUsersQuery): Promise<Paginated<UserDto>> {
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.search
        ? {
            OR: [
              { email: { contains: q.search, mode: 'insensitive' } },
              { name: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { skip, take } = skipTake(q);
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
      prisma.user.count({ where }),
    ]);
    return paginated(rows.map(toUserDto), total, q);
  },

  async setRole(adminId: string, userId: string, role: Role): Promise<UserDto> {
    if (adminId === userId) {
      throw new ConflictError('You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');
    return toUserDto(await prisma.user.update({ where: { id: userId }, data: { role } }));
  },
};

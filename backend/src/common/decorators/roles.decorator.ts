import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Marks a route handler (or controller) as requiring one of the specified roles.
 * Pair with `RolesGuard` to enforce RBAC.
 *
 * @example
 * \@Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
 * \@Delete(':id')
 * remove(...) { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

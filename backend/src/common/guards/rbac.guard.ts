import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role-Based Access Control guard.
 *
 * Reads the `@Roles(...)` metadata from the handler (or controller) and
 * verifies that the currently authenticated user (attached by `JwtAuthGuard`)
 * has at least one of the allowed roles.
 *
 * If no `@Roles` metadata is present the guard allows the request through
 * (authentication-only). Must be used **after** `JwtAuthGuard`.
 *
 * @example
 * \@UseGuards(JwtAuthGuard, RolesGuard)
 * \@Roles(UserRole.TEAM_ADMIN)
 * \@Post()
 * create(...) { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No role restriction — only authentication is required.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // SUPER_ADMIN bypasses every role check.
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

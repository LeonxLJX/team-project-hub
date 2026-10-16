import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard. Wraps the passport-jwt strategy configured in
 * `auth/jwt.strategy.ts`. Use on protected routes:
 *
 * @example
 * \@UseGuards(JwtAuthGuard)
 * \@Get('profile')
 * getProfile() { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Add any custom pre-flight logic here if needed.
    return super.canActivate(context);
  }
}

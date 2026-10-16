import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

/**
 * Shape of the JWT payload (what gets signed into the token).
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  teamId?: string | null;
}

/**
 * Shape attached to `request.user` after successful validation.
 */
export interface AuthenticatedUser extends JwtPayload {
  name: string;
}

/**
 * Passport JWT strategy.
 *
 * Extracts the Bearer token from the Authorization header, verifies it with
 * the configured `JWT_SECRET`, then loads the matching user from the database
 * to ensure the account still exists and is up-to-date.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
  }
}

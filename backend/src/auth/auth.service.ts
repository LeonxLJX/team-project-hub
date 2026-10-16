import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { InviteDto, AcceptInviteDto } from './dto/invite.dto';
import { JwtPayload } from './jwt.strategy';
import { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 10;
const INVITE_TTL_HOURS = 72;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // Registration & Login
  // ─────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // First user ever becomes SUPER_ADMIN; everyone else defaults to DEVELOPER.
    const userCount = await this.prisma.user.count();
    const role: UserRole = userCount === 0 ? UserRole.SUPER_ADMIN : UserRole.DEVELOPER;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role,
        teamId: dto.teamId ?? null,
      },
      select: this.publicUserSelect(),
    });

    return {
      user,
      accessToken: this.generateJwt(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      user: this.stripPassword(user),
      accessToken: this.generateJwt(user),
    };
  }

  /**
   * Validates a user by id + password. Used by local strategy if added later.
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? this.stripPassword(user) : null;
  }

  // ─────────────────────────────────────────────────────────
  // JWT helpers
  // ─────────────────────────────────────────────────────────

  generateJwt(user: { id: string; email: string; role: UserRole; teamId?: string | null }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId ?? null,
    };
    return this.jwtService.sign(payload);
  }

  // ─────────────────────────────────────────────────────────
  // Invitations
  // ─────────────────────────────────────────────────────────

  /**
   * Creates a pending team invitation. Only TEAM_ADMIN / SUPER_ADMIN should
   * be allowed to call this (enforced at controller level via RBAC).
   */
  async inviteUser(dto: InviteDto, invitedById: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // A user with this email may already exist — attach them to the team
    // immediately if they're not already a member.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser && !existingUser.teamId) {
      const updated = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { teamId: dto.teamId, role: dto.role ?? UserRole.DEVELOPER },
      });
      return { message: 'User added to team', user: this.stripPassword(updated) };
    }

    // Otherwise create a token-based invite.
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    const invite = await this.prisma.teamInvite.create({
      data: {
        teamId: dto.teamId,
        email: dto.email.toLowerCase(),
        invitedBy: invitedById,
        role: dto.role ?? UserRole.DEVELOPER,
        token,
        expiresAt,
      },
    });

    // In production this would dispatch an email via the mailer / BullMQ queue.
    const inviteUrl = `${this.configService.get<string>(
      'FRONTEND_URL',
    )}/accept-invite?token=${token}`;
    this.logger.log(`Invite URL for ${dto.email}: ${inviteUrl}`);

    return { message: 'Invitation sent', invite: { id: invite.id, email: invite.email } };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { token: dto.token },
    });

    if (!invite) {
      throw new BadRequestException('Invalid invitation token');
    }
    if (invite.acceptedAt) {
      throw new BadRequestException('Invitation already accepted');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { teamId: invite.teamId, role: invite.role },
      });
    } else {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      await this.prisma.user.create({
        data: {
          name: dto.name,
          email: invite.email,
          passwordHash,
          role: invite.role,
          teamId: invite.teamId,
        },
      });
    }

    await this.prisma.teamInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return { message: 'Invitation accepted. You may now log in.' };
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  private publicUserSelect() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private stripPassword(user: { passwordHash?: string; [k: string]: unknown }) {
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  }
}

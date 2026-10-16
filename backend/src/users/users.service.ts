import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { UserRole } from '@prisma/client';

const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  teamId: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface Actor {
  sub: string;
  role: UserRole;
  teamId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listing & profile ───────────────────────────────────

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<unknown>> {
    const { skip = 0, take = 20 } = pagination;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        select: PUBLIC_USER_FIELDS,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { items, total, skip, take };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_FIELDS,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Returns the full public profile of the currently authenticated user.
   */
  async getProfile(userId: string) {
    return this.findOne(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        email: dto.email?.toLowerCase(),
      },
      select: PUBLIC_USER_FIELDS,
    });
  }

  // ── Role management (admin only) ────────────────────────

  async updateRole(id: string, dto: UpdateRoleDto, actor: Actor) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    this.ensureCanUpdateRole(target, actor);

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: PUBLIC_USER_FIELDS,
    });
  }

  // ── Helpers ─────────────────────────────────────────────

  private ensureCanUpdateRole(
    target: { role: UserRole; teamId?: string | null },
    actor: Actor,
  ) {
    // SUPER_ADMIN can change anyone's role.
    if (actor.role === UserRole.SUPER_ADMIN) return;

    // TEAM_ADMIN can change roles of members within their own team,
    // but cannot promote/demote other TEAM_ADMINs or SUPER_ADMINs.
    if (
      actor.role === UserRole.TEAM_ADMIN &&
      target.teamId === actor.teamId &&
      target.role !== UserRole.SUPER_ADMIN &&
      target.role !== UserRole.TEAM_ADMIN
    ) {
      return;
    }

    throw new ForbiddenException('You do not have permission to update this user\'s role');
  }
}

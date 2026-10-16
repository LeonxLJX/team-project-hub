import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { UserRole, Team } from '@prisma/client';

interface Actor {
  sub: string;
  role: UserRole;
  teamId?: string | null;
}

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────

  async create(dto: CreateTeamDto, actor: Actor): Promise<Team> {
    // SUPER_ADMIN can create teams directly; others create and become TEAM_ADMIN of it.
    return this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
      },
    });
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Team>> {
    const { skip = 0, take = 20 } = pagination;
    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.team.count(),
    ]);
    return { items, total, skip, take };
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, actor: Actor): Promise<Team> {
    await this.ensureTeamExists(id);
    this.ensureCanManageTeam(id, actor);

    return this.prisma.team.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await this.ensureTeamExists(id);
    this.ensureCanManageTeam(id, actor);

    await this.prisma.team.delete({ where: { id } });
  }

  // ── Member management ───────────────────────────────────

  async getMembers(teamId: string) {
    await this.ensureTeamExists(teamId);
    return this.prisma.user.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async addMember(teamId: string, userId: string, actor: Actor) {
    await this.ensureTeamExists(teamId);
    this.ensureCanManageTeam(teamId, actor);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.teamId === teamId) {
      throw new ConflictException('User is already a member of this team');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { teamId },
      select: { id: true, name: true, email: true, role: true, teamId: true },
    });
  }

  async removeMember(teamId: string, userId: string, actor: Actor) {
    await this.ensureTeamExists(teamId);
    this.ensureCanManageTeam(teamId, actor);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.teamId !== teamId) {
      throw new NotFoundException('User is not a member of this team');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { teamId: null },
      select: { id: true, name: true, email: true, role: true, teamId: true },
    });
  }

  // ── Helpers ─────────────────────────────────────────────

  private async ensureTeamExists(id: string) {
    const exists = await this.prisma.team.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Team not found');
  }

  private ensureCanManageTeam(teamId: string, actor: Actor) {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (actor.role === UserRole.TEAM_ADMIN && actor.teamId === teamId) return;
    throw new ForbiddenException(
      'You do not have permission to manage this team',
    );
  }
}

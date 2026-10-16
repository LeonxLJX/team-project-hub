import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { ProjectStatus, UserRole, Project } from '@prisma/client';

interface Actor {
  sub: string;
  role: UserRole;
  teamId?: string | null;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────

  async create(dto: CreateProjectDto, actor: Actor): Promise<Project> {
    // Ensure team exists.
    const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
    if (!team) throw new NotFoundException('Team not found');

    // Only members of the team (or super admin) can create projects for it.
    if (actor.role !== UserRole.SUPER_ADMIN && actor.teamId !== dto.teamId) {
      throw new ForbiddenException(
        'You can only create projects for your own team',
      );
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        status: dto.status ?? ProjectStatus.PLANNING,
        teamId: dto.teamId,
        managerId: dto.managerId ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async findAll(
    pagination: PaginationDto,
    filters: { teamId?: string; status?: ProjectStatus; managerId?: string },
  ): Promise<PaginatedResult<Project>> {
    const { skip = 0, take = 20 } = pagination;
    const where: Record<string, unknown> = {};
    if (filters.teamId) where.teamId = filters.teamId;
    if (filters.status) where.status = filters.status;
    if (filters.managerId) where.managerId = filters.managerId;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          manager: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
        tasks: { select: { id: true, title: true, status: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, actor: Actor): Promise<Project> {
    const project = await this.ensureProjectExists(id);
    this.ensureCanManageProject(project, actor);

    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const project = await this.ensureProjectExists(id);
    this.ensureCanManageProject(project, actor);

    await this.prisma.project.delete({ where: { id } });
  }

  // ── Archive ─────────────────────────────────────────────

  async archive(id: string, actor: Actor): Promise<Project> {
    const project = await this.ensureProjectExists(id);
    this.ensureCanManageProject(project, actor);

    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.ARCHIVED },
    });
  }

  // ── Assign manager ──────────────────────────────────────

  async assignManager(id: string, managerId: string, actor: Actor): Promise<Project> {
    const project = await this.ensureProjectExists(id);
    this.ensureCanManageProject(project, actor);

    // Verify the manager belongs to the same team.
    const manager = await this.prisma.user.findUnique({ where: { id: managerId } });
    if (!manager) throw new NotFoundException('Manager user not found');
    if (manager.teamId !== project.teamId) {
      throw new ForbiddenException('Manager must be a member of the project team');
    }

    return this.prisma.project.update({
      where: { id },
      data: { managerId },
    });
  }

  // ── Helpers ─────────────────────────────────────────────

  private async ensureProjectExists(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private ensureCanManageProject(
    project: { teamId: string; managerId?: string | null },
    actor: Actor,
  ) {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (actor.role === UserRole.TEAM_ADMIN && actor.teamId === project.teamId) return;
    if (project.managerId === actor.sub) return;
    throw new ForbiddenException(
      'You do not have permission to manage this project',
    );
  }
}

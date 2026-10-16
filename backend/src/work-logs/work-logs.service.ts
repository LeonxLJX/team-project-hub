import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { FilterWorkLogDto } from './dto/filter-work-log.dto';
import { WorkLogStatus, UserRole } from '@prisma/client';

const MAX_HOURS_PER_DAY = 24;
const APPROVAL_THRESHOLD_HOURS = 8;

interface Actor {
  sub: string;
  role: UserRole;
  teamId?: string | null;
}

@Injectable()
export class WorkLogsService {
  private readonly logger = new Logger(WorkLogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  /**
   * Verifies the actor can access the task's project (team-based).
   */
  private async ensureTaskProjectAccess(taskId: string, actor: Actor) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, title: true, assigneeId: true },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: task.projectId },
      select: { id: true, teamId: true, managerId: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (actor.role === UserRole.SUPER_ADMIN) return task;
    if (actor.role === UserRole.TEAM_ADMIN && actor.teamId === project.teamId) return task;
    if (project.managerId === actor.sub) return task;
    if (actor.teamId === project.teamId) return task;

    throw new ForbiddenException('You do not have access to this task');
  }

  /**
   * Determines whether the actor can approve/reject work logs for a project.
   */
  private async canApprove(projectId: string, actor: Actor): Promise<boolean> {
    if (actor.role === UserRole.SUPER_ADMIN) return true;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true, managerId: true },
    });

    if (!project) return false;
    if (actor.role === UserRole.TEAM_ADMIN && actor.teamId === project.teamId) return true;
    if (project.managerId === actor.sub) return true;
    return false;
  }

  async create(actor: Actor, dto: CreateWorkLogDto) {
    const task = await this.ensureTaskProjectAccess(dto.taskId, actor);

    // Validate total hours don't exceed 24h/day for the user on that date
    const logDate = new Date(dto.logDate);
    const startOfDay = new Date(logDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(logDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingHours = await this.prisma.workLog.aggregate({
      where: {
        userId: actor.sub,
        logDate: { gte: startOfDay, lte: endOfDay },
        status: { in: [WorkLogStatus.PENDING, WorkLogStatus.APPROVED] },
      },
      _sum: { hours: true },
    });

    const totalHours = (existingHours._sum.hours ?? 0) + dto.hours;
    if (totalHours > MAX_HOURS_PER_DAY) {
      throw new BadRequestException(
        `Total logged hours for this day (${totalHours}h) exceeds the maximum of ${MAX_HOURS_PER_DAY}h`,
      );
    }

    const requiresApproval = dto.hours > APPROVAL_THRESHOLD_HOURS;

    const workLog = await this.prisma.workLog.create({
      data: {
        taskId: dto.taskId,
        userId: actor.sub,
        hours: dto.hours,
        overtimeHours: dto.overtimeHours ?? 0,
        logDate,
        description: dto.description,
        status: requiresApproval ? WorkLogStatus.PENDING : WorkLogStatus.APPROVED,
        requiresApproval,
      },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(
      `Work log ${workLog.id} created by user ${actor.sub} for task ${dto.taskId} (${dto.hours}h)`,
    );

    if (requiresApproval) {
      // Notify project manager & team admins
      const project = await this.prisma.project.findUnique({
        where: { id: task.projectId },
        select: { teamId: true, managerId: true },
      });

      const notifyUserIds = new Set<string>();
      if (project?.managerId) notifyUserIds.add(project.managerId);

      const teamAdmins = await this.prisma.user.findMany({
        where: {
          teamId: project?.teamId,
          role: UserRole.TEAM_ADMIN,
          id: { not: actor.sub },
        },
        select: { id: true },
      });
      teamAdmins.forEach((u) => notifyUserIds.add(u.id));

      if (notifyUserIds.size > 0) {
        await this.prisma.notification.createMany({
          data: Array.from(notifyUserIds).map((uid) => ({
            userId: uid,
            type: 'WORKLOG_APPROVAL_REQUEST',
            title: 'Work log approval requested',
            message: `${dto.hours}h work log on "${task.title}" requires your approval`,
            data: { workLogId: workLog.id, taskId: task.id },
          })),
        });
      }
    }

    return workLog;
  }

  async findByTask(actor: Actor, taskId: string, filters: FilterWorkLogDto) {
    await this.ensureTaskProjectAccess(taskId, actor);
    return this.findMany({ taskId }, filters);
  }

  async findByUser(actor: Actor, targetUserId: string, filters: FilterWorkLogDto) {
    if (targetUserId !== actor.sub) {
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        actor.role !== UserRole.TEAM_ADMIN &&
        actor.role !== UserRole.PROJECT_MANAGER
      ) {
        throw new ForbiddenException('You can only view your own work logs');
      }
    }
    return this.findMany({ userId: targetUserId }, filters);
  }

  async findByProject(actor: Actor, projectId: string, filters: FilterWorkLogDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true, managerId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (actor.role !== UserRole.SUPER_ADMIN) {
      if (
        actor.role !== UserRole.TEAM_ADMIN ||
        actor.teamId !== project.teamId
      ) {
        if (project.managerId !== actor.sub && actor.teamId !== project.teamId) {
          throw new ForbiddenException('You do not have access to this project');
        }
      }
    }

    return this.findMany({ task: { projectId } }, filters);
  }

  private async findMany(baseWhere: any, filters: FilterWorkLogDto) {
    const where: any = { ...baseWhere };

    if (filters.startDate) {
      where.logDate = { ...(where.logDate ?? {}), gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.logDate = { ...(where.logDate ?? {}), lte: new Date(filters.endDate) };
    }
    if (filters.status) where.status = filters.status;

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.workLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { logDate: 'desc' },
        include: {
          task: { select: { id: true, title: true, projectId: true } },
          user: { select: { id: true, name: true, email: true, avatar: true } },
          reviewer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.workLog.count({ where }),
    ]);

    const totalHours = await this.prisma.workLog.aggregate({
      where,
      _sum: { hours: true, overtimeHours: true },
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalHours: totalHours._sum.hours ?? 0,
        totalOvertimeHours: totalHours._sum.overtimeHours ?? 0,
      },
    };
  }

  async approve(actor: Actor, workLogId: string) {
    const workLog = await this.prisma.workLog.findUnique({
      where: { id: workLogId },
      include: { task: { select: { projectId: true, title: true } } },
    });

    if (!workLog) {
      throw new NotFoundException(`Work log ${workLogId} not found`);
    }

    if (workLog.status !== WorkLogStatus.PENDING) {
      throw new BadRequestException(`Work log is not pending approval (current: ${workLog.status})`);
    }

    const canApprove = await this.canApprove(workLog.task.projectId, actor);
    if (!canApprove) {
      throw new ForbiddenException('Only project admins, team admins, or super admins can approve work logs');
    }

    const approved = await this.prisma.workLog.update({
      where: { id: workLogId },
      data: {
        status: WorkLogStatus.APPROVED,
        reviewedById: actor.sub,
        reviewedAt: new Date(),
      },
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Work log ${workLogId} approved by user ${actor.sub}`);

    await this.prisma.notification.create({
      data: {
        userId: workLog.userId,
        type: 'WORKLOG_APPROVED',
        title: 'Work log approved',
        message: `Your ${workLog.hours}h work log on "${workLog.task.title}" was approved`,
        data: { workLogId, taskId: workLog.taskId },
      },
    });

    await this.reportsQueue.add('recalculate-project', {
      projectId: workLog.task.projectId,
    });

    return approved;
  }

  async reject(actor: Actor, workLogId: string, reason?: string) {
    const workLog = await this.prisma.workLog.findUnique({
      where: { id: workLogId },
      include: { task: { select: { projectId: true, title: true } } },
    });

    if (!workLog) {
      throw new NotFoundException(`Work log ${workLogId} not found`);
    }

    if (workLog.status !== WorkLogStatus.PENDING) {
      throw new BadRequestException(`Work log is not pending approval (current: ${workLog.status})`);
    }

    const canApprove = await this.canApprove(workLog.task.projectId, actor);
    if (!canApprove) {
      throw new ForbiddenException('Only project admins, team admins, or super admins can reject work logs');
    }

    const rejected = await this.prisma.workLog.update({
      where: { id: workLogId },
      data: {
        status: WorkLogStatus.REJECTED,
        reviewedById: actor.sub,
        reviewedAt: new Date(),
        rejectionReason: reason ?? null,
      },
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Work log ${workLogId} rejected by user ${actor.sub}`);

    await this.prisma.notification.create({
      data: {
        userId: workLog.userId,
        type: 'WORKLOG_REJECTED',
        title: 'Work log rejected',
        message: `Your ${workLog.hours}h work log on "${workLog.task.title}" was rejected`,
        data: { workLogId, taskId: workLog.taskId },
      },
    });

    return rejected;
  }
}

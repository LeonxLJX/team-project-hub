import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { CreateCommentDto } from './dto/comment.dto';
import { TaskStatus, TaskPriority, UserRole } from '@prisma/client';

interface Actor {
  sub: string;
  role: UserRole;
  teamId?: string | null;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies that the actor can access the project.
   * Access is granted when the actor is a SUPER_ADMIN, a TEAM_ADMIN of the
   * project's team, a PROJECT_MANAGER of the project, or a member of the team
   * that owns the project.
   */
  private async ensureProjectAccess(projectId: string, actor: Actor): Promise<void> {
    if (actor.role === UserRole.SUPER_ADMIN) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, teamId: true, managerId: true },
    });

    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    if (actor.role === UserRole.TEAM_ADMIN && actor.teamId === project.teamId) return;
    if (project.managerId === actor.sub) return;
    if (actor.teamId === project.teamId) return; // team member

    throw new ForbiddenException('You do not have access to this project');
  }

  /**
   * Ensures the task exists and the actor can access its project.
   */
  private async ensureTaskAccess(taskId: string, actor: Actor) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        projectId: true,
        assigneeId: true,
        status: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }

    await this.ensureProjectAccess(task.projectId, actor);
    return task;
  }

  async create(actor: Actor, dto: CreateTaskDto) {
    await this.ensureProjectAccess(dto.projectId, actor);

    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: dto.parentTaskId },
        select: { id: true, projectId: true },
      });
      if (!parent || parent.projectId !== dto.projectId) {
        throw new BadRequestException('Parent task does not exist in this project');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        projectId: dto.projectId,
        assigneeId: dto.assigneeId ?? null,
        reporterId: actor.sub,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        parentTaskId: dto.parentTaskId ?? null,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Task ${task.id} created by user ${actor.sub}`);

    if (dto.assigneeId && dto.assigneeId !== actor.sub) {
      await this.prisma.notification.create({
        data: {
          userId: dto.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'New task assigned',
          message: `You have been assigned a new task: "${task.title}"`,
          data: { taskId: task.id, projectId: task.projectId },
        },
      });
    }

    return task;
  }

  async findAll(actor: Actor, filters: FilterTaskDto) {
    const where: any = {};

    if (filters.projectId) {
      await this.ensureProjectAccess(filters.projectId, actor);
      where.projectId = filters.projectId;
    } else {
      // Restrict to projects in the user's team (or all if super admin)
      if (actor.role !== UserRole.SUPER_ADMIN && actor.teamId) {
        const teamProjects = await this.prisma.project.findMany({
          where: { teamId: actor.teamId },
          select: { id: true },
        });
        where.projectId = { in: teamProjects.map((p) => p.id) };
      }
    }

    if (filters.status) where.status = filters.status;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.reporterId) where.reporterId = filters.reporterId;
    if (filters.priority) where.priority = filters.priority;

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [filters.sortBy ?? 'createdAt']: filters.sortOrder ?? 'desc' },
        include: {
          assignee: { select: { id: true, name: true, email: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(actor: Actor, id: string) {
    await this.ensureTaskAccess(id, actor);

    return this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        reporter: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, avatar: true } },
          },
          take: 50,
        },
        _count: { select: { comments: true, workLogs: true } },
      },
    });
  }

  async update(actor: Actor, id: string, dto: UpdateTaskDto) {
    const task = await this.ensureTaskAccess(id, actor);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    const updated = await this.prisma.task.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Task ${id} updated by user ${actor.sub}`);

    if (dto.assigneeId && dto.assigneeId !== actor.sub && dto.assigneeId !== task.assigneeId) {
      await this.prisma.notification.create({
        data: {
          userId: dto.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'Task reassigned',
          message: `Task "${updated.title}" has been assigned to you`,
          data: { taskId: id, projectId: task.projectId },
        },
      });
    }

    return updated;
  }

  async updateStatus(actor: Actor, id: string, status: TaskStatus) {
    const task = await this.ensureTaskAccess(id, actor);

    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.TODO, TaskStatus.CANCELLED],
      [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.DONE]: [],
      [TaskStatus.CANCELLED]: [],
    };

    if (status !== task.status && !validTransitions[task.status]?.includes(status)) {
      throw new BadRequestException(
        `Invalid status transition from ${task.status} to ${status}`,
      );
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status },
      include: {
        reporter: { select: { id: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Task ${id} status changed to ${status} by user ${actor.sub}`);

    return updated;
  }

  async delete(actor: Actor, id: string) {
    await this.ensureTaskAccess(id, actor);

    await this.prisma.taskComment.deleteMany({ where: { taskId: id } });
    await this.prisma.task.delete({ where: { id } });

    this.logger.log(`Task ${id} deleted by user ${actor.sub}`);

    return { success: true, message: `Task ${id} has been deleted` };
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async addComment(actor: Actor, taskId: string, dto: CreateCommentDto) {
    await this.ensureTaskAccess(taskId, actor);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: actor.sub,
        content: dto.content,
        attachmentUrl: dto.attachmentUrl ?? null,
        mentions: dto.mentions ?? [],
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        task: { select: { id: true, title: true, projectId: true, reporterId: true, assigneeId: true } },
      },
    });

    const participants = new Set<string>();
    if (comment.task.reporterId) participants.add(comment.task.reporterId);
    if (comment.task.assigneeId) participants.add(comment.task.assigneeId);
    participants.delete(actor.sub);

    const notifications = Array.from(participants).map((uid) => ({
      userId: uid,
      type: 'TASK_COMMENT',
      title: 'New comment on task',
      message: `New comment on "${comment.task.title}"`,
      data: { taskId, commentId: comment.id, projectId: comment.task.projectId },
    }));

    if (notifications.length > 0) {
      await this.prisma.notification.createMany({ data: notifications });
    }

    return comment;
  }

  async getComments(actor: Actor, taskId: string, page = 1, limit = 50) {
    await this.ensureTaskAccess(taskId, actor);

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.taskComment.findMany({
        where: { taskId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
      }),
      this.prisma.taskComment.count({ where: { taskId } }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

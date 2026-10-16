import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { WorkLogStatus } from '@prisma/client';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_KEY_PREFIX = 'report:stats:';

@Injectable()
export class ReportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsService.name);
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST') ?? 'localhost';
    const redisPort = Number(this.configService.get<number>('REDIS_PORT') ?? 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for report caching');
    });
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  private async getCachedOrCompute<T>(
    cacheKey: string,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      this.logger.warn(`Redis read failed, computing fresh: ${err.message}`);
    }

    const result = await computeFn();

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Redis write failed: ${err.message}`);
    }

    return result;
  }

  async invalidateCache(pattern: string) {
    try {
      const keys = await this.redis.keys(`${CACHE_KEY_PREFIX}${pattern}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Invalidated ${keys.length} cache keys matching "${pattern}"`);
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation failed: ${err.message}`);
    }
  }

  async getProjectWorkHoursStats(projectId: string) {
    const cacheKey = `${CACHE_KEY_PREFIX}project:${projectId}`;

    return this.getCachedOrCompute(cacheKey, async () => {
      const tasks = await this.prisma.task.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assigneeId: true,
          workLogs: {
            where: { status: WorkLogStatus.APPROVED },
            select: { hours: true, overtimeHours: true, userId: true, logDate: true },
          },
        },
      });

      const perTask = tasks.map((task) => {
        const totalHours = task.workLogs.reduce((sum, w) => sum + w.hours, 0);
        const totalOvertime = task.workLogs.reduce((sum, w) => sum + (w.overtimeHours ?? 0), 0);
        return {
          taskId: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          totalHours: Number(totalHours.toFixed(2)),
          totalOvertimeHours: Number(totalOvertime.toFixed(2)),
          logCount: task.workLogs.length,
        };
      });

      const userHoursMap = new Map<string, { hours: number; overtime: number; count: number }>();
      for (const task of tasks) {
        for (const log of task.workLogs) {
          const existing = userHoursMap.get(log.userId) ?? { hours: 0, overtime: 0, count: 0 };
          existing.hours += log.hours;
          existing.overtime += log.overtimeHours ?? 0;
          existing.count += 1;
          userHoursMap.set(log.userId, existing);
        }
      }

      const perUser = Array.from(userHoursMap.entries()).map(([userId, agg]) => ({
        userId,
        totalHours: Number(agg.hours.toFixed(2)),
        totalOvertimeHours: Number(agg.overtime.toFixed(2)),
        logCount: agg.count,
      }));

      const totalProjectHours = perUser.reduce((sum, u) => sum + u.totalHours, 0);

      return {
        projectId,
        totalTasks: tasks.length,
        totalHours: Number(totalProjectHours.toFixed(2)),
        perTask,
        perUser,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async getUserWorkloadStats(userId: string) {
    const cacheKey = `${CACHE_KEY_PREFIX}user:${userId}`;

    return this.getCachedOrCompute(cacheKey, async () => {
      const workLogs = await this.prisma.workLog.findMany({
        where: {
          userId,
          status: WorkLogStatus.APPROVED,
        },
        select: {
          hours: true,
          overtimeHours: true,
          logDate: true,
          task: {
            select: {
              id: true,
              title: true,
              projectId: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { logDate: 'desc' },
      });

      const totalHours = workLogs.reduce((sum, w) => sum + w.hours, 0);
      const totalOvertime = workLogs.reduce((sum, w) => sum + (w.overtimeHours ?? 0), 0);

      const projectMap = new Map<string, { name: string; hours: number; overtime: number; count: number }>();
      for (const log of workLogs) {
        const pid = log.task.projectId;
        const existing = projectMap.get(pid) ?? {
          name: log.task.project.name,
          hours: 0,
          overtime: 0,
          count: 0,
        };
        existing.hours += log.hours;
        existing.overtime += log.overtimeHours ?? 0;
        existing.count += 1;
        projectMap.set(pid, existing);
      }

      const perProject = Array.from(projectMap.entries()).map(([projectId, agg]) => ({
        projectId,
        projectName: agg.name,
        totalHours: Number(agg.hours.toFixed(2)),
        totalOvertimeHours: Number(agg.overtime.toFixed(2)),
        logCount: agg.count,
      }));

      return {
        userId,
        totalHours: Number(totalHours.toFixed(2)),
        totalOvertimeHours: Number(totalOvertime.toFixed(2)),
        logCount: workLogs.length,
        perProject,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async getTeamStats(teamId: string) {
    const cacheKey = `${CACHE_KEY_PREFIX}team:${teamId}`;

    return this.getCachedOrCompute(cacheKey, async () => {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          name: true,
          members: { select: { userId: true, role: true } },
          projects: {
            select: {
              id: true,
              name: true,
              tasks: {
                select: {
                  status: true,
                  workLogs: {
                    where: { status: WorkLogStatus.APPROVED },
                    select: { hours: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!team) {
        return null;
      }

      const memberCount = team.members.length;
      let totalHours = 0;
      const taskStatusCount: Record<string, number> = {};

      for (const project of team.projects) {
        for (const task of project.tasks) {
          taskStatusCount[task.status] = (taskStatusCount[task.status] ?? 0) + 1;
          totalHours += task.workLogs.reduce((sum, w) => sum + w.hours, 0);
        }
      }

      return {
        teamId: team.id,
        teamName: team.name,
        memberCount,
        projectCount: team.projects.length,
        totalHours: Number(totalHours.toFixed(2)),
        taskStatusDistribution: taskStatusCount,
        generatedAt: new Date().toISOString(),
      };
    });
  }
}

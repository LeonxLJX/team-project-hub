import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReportsService } from './reports.service';
import { ExportReportDto, ExportFormat } from './dto/export-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UserRole } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  @Get('project/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  getProjectWorkHoursStats(@Param('id') id: string) {
    return this.reportsService.getProjectWorkHoursStats(id);
  }

  @Get('team/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  async getTeamStats(@Param('id') id: string) {
    const stats = await this.reportsService.getTeamStats(id);
    if (!stats) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return stats;
  }

  @Get('user/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  getUserWorkloadStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const targetId = id ?? user.sub;
    return this.reportsService.getUserWorkloadStats(targetId);
  }

  @Post('export')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async exportReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExportReportDto,
  ) {
    const jobName =
      dto.format === ExportFormat.EXCEL ? 'exportExcel' : 'exportCsv';

    const job = await this.reportsQueue.add(
      jobName,
      {
        type: dto.type,
        targetId: dto.targetId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        requestedById: user.sub,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return {
      message: 'Report export has been queued. You will receive an email when it is ready.',
      jobId: job.id,
      jobName,
      format: dto.format,
    };
  }
}

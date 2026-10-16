import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkLogsService } from './work-logs.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { FilterWorkLogDto } from './dto/filter-work-log.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UserRole } from '@prisma/client';

@Controller('work-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkLogsController {
  constructor(private readonly workLogsService: WorkLogsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkLogDto) {
    return this.workLogsService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() filters: FilterWorkLogDto) {
    if (filters.taskId) {
      return this.workLogsService.findByTask(user, filters.taskId, filters);
    }
    if (filters.projectId) {
      return this.workLogsService.findByProject(user, filters.projectId, filters);
    }
    return this.workLogsService.findByUser(user, filters.userId ?? user.sub, filters);
  }

  @Get('task/:taskId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  findByTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Query() filters: FilterWorkLogDto,
  ) {
    return this.workLogsService.findByTask(user, taskId, filters);
  }

  @Get('user/:userId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  findByUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Query() filters: FilterWorkLogDto,
  ) {
    return this.workLogsService.findByUser(user, userId, filters);
  }

  @Get('project/:projectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  findByProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query() filters: FilterWorkLogDto,
  ) {
    return this.workLogsService.findByProject(user, projectId, filters);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.workLogsService.approve(user, id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.workLogsService.reject(user, id, reason);
  }
}

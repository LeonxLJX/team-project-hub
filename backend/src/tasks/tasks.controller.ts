import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { CreateCommentDto } from './dto/comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { TaskStatus, UserRole } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() filters: FilterTaskDto) {
    return this.tasksService.findAll(user, filters);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tasksService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
  ) {
    return this.tasksService.updateStatus(user, id, status);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tasksService.delete(user, id);
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  @Post(':id/comments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.addComment(user, id, dto);
  }

  @Get(':id/comments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  getComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasksService.getComments(
      user,
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }
}

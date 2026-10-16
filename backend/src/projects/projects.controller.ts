import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ── CRUD ────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryProjectsDto) {
    const { skip, take, sort, order, teamId, status, managerId } = query;
    return this.projectsService.findAll(
      { skip, take, sort, order },
      { teamId, status, managerId },
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.remove(id, user);
  }

  // ── Archive & assign manager ────────────────────────────

  @Patch(':id/archive')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER)
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.archive(id, user);
  }

  @Patch(':id/manager/:managerId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  assignManager(
    @Param('id') id: string,
    @Param('managerId') managerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.assignManager(id, managerId, user);
  }
}

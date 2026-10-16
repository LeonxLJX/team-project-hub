import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FilterNotificationDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UserRole } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  getUserNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: FilterNotificationDto,
  ) {
    return this.notificationsService.getUserNotifications(user.sub, {
      unreadOnly: filters.unreadOnly,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  @Get('unread-count')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService
      .getUnreadCount(user.sub)
      .then((count) => ({ count }));
  }

  @Patch(':id/read')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(user.sub, id);
  }

  @Patch('read-all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.sub);
  }
}

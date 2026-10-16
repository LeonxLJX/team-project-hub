import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UserRole } from '@prisma/client';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.filesService.uploadVersion(user, dto, file);
  }

  @Get(':taskId/versions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  listVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.filesService.listVersions(user, taskId);
  }

  @Get(':versionId/download')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('versionId') versionId: string,
  ) {
    return this.filesService.getDownloadUrl(user, versionId);
  }

  @Delete(':versionId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.PROJECT_MANAGER, UserRole.DEVELOPER)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('versionId') versionId: string,
  ) {
    return this.filesService.deleteVersion(user, versionId);
  }
}

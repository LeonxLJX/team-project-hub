import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from './minio.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { UserRole } from '@prisma/client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
];

interface Actor {
  sub: string;
  role: UserRole;
  teamId?: string | null;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  private async ensureTaskProjectAccess(taskId: string, actor: Actor) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, title: true },
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

  async uploadVersion(
    actor: Actor,
    dto: UploadFileDto,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    const task = await this.ensureTaskProjectAccess(dto.taskId, actor);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds the maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed`);
    }

    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { taskId: dto.taskId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;
    const objectKey = `tasks/${dto.taskId}/v${nextVersion}/${Date.now()}-${file.originalname}`;

    await this.minioService.uploadVersion(objectKey, file.buffer, {
      'Content-Type': file.mimetype,
    });

    const fileVersion = await this.prisma.fileVersion.create({
      data: {
        taskId: dto.taskId,
        versionNumber: nextVersion,
        objectKey,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        description: dto.description ?? null,
        uploadedById: actor.sub,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true, projectId: true } },
      },
    });

    this.logger.log(
      `File version v${nextVersion} uploaded for task ${dto.taskId} by user ${actor.sub}`,
    );

    return fileVersion;
  }

  async listVersions(actor: Actor, taskId: string) {
    await this.ensureTaskProjectAccess(taskId, actor);

    const versions = await this.prisma.fileVersion.findMany({
      where: { taskId },
      orderBy: { versionNumber: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true, avatar: true } },
      },
    });

    return {
      items: versions,
      meta: {
        total: versions.length,
        latestVersion: versions[0]?.versionNumber ?? 0,
      },
    };
  }

  async getDownloadUrl(actor: Actor, versionId: string) {
    const version = await this.prisma.fileVersion.findUnique({
      where: { id: versionId },
      include: { task: { select: { projectId: true } } },
    });

    if (!version) {
      throw new NotFoundException(`File version ${versionId} not found`);
    }

    await this.ensureTaskProjectAccess(version.taskId, actor);

    const url = await this.minioService.getFileUrl(version.objectKey, 3600);

    return {
      url,
      fileName: version.fileName,
      mimeType: version.mimeType,
      fileSize: version.fileSize,
      expiresIn: 3600,
    };
  }

  async deleteVersion(actor: Actor, versionId: string) {
    const version = await this.prisma.fileVersion.findUnique({
      where: { id: versionId },
      include: { task: { select: { projectId: true, teamId: true } } },
    });

    if (!version) {
      throw new NotFoundException(`File version ${versionId} not found`);
    }

    const task = await this.ensureTaskProjectAccess(version.taskId, actor);

    const isUploader = version.uploadedById === actor.sub;
    const isAdmin =
      actor.role === UserRole.SUPER_ADMIN ||
      actor.role === UserRole.TEAM_ADMIN ||
      (actor.role === UserRole.PROJECT_MANAGER && actor.sub === task.projectId /* manager check below */);

    // Determine if actor is project manager
    const project = await this.prisma.project.findUnique({
      where: { id: task.projectId },
      select: { managerId: true, teamId: true },
    });

    const isProjectManager = project?.managerId === actor.sub;
    const isTeamAdmin = actor.role === UserRole.TEAM_ADMIN && actor.teamId === project?.teamId;

    if (!isUploader && !isProjectManager && !isTeamAdmin && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You can only delete your own file versions');
    }

    try {
      await this.minioService.deleteFile(version.objectKey);
    } catch (error) {
      this.logger.warn(
        `Failed to delete MinIO object ${version.objectKey}: ${error.message}`,
      );
    }

    await this.prisma.fileVersion.delete({ where: { id: versionId } });

    this.logger.log(
      `File version ${versionId} (v${version.versionNumber}) deleted by user ${actor.sub}`,
    );

    return { success: true, message: `File version ${versionId} has been deleted` };
  }
}

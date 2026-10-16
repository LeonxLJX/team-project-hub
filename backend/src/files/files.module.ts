import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { MinioService } from './minio.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [FilesController],
  providers: [FilesService, MinioService],
  exports: [FilesService, MinioService],
})
export class FilesModule {}

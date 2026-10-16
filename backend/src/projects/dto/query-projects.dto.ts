import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ProjectStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryProjectsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}

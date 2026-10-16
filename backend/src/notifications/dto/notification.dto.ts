import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
  IsIn,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_COMMENT',
  'TASK_STATUS_CHANGED',
  'WORKLOG_APPROVAL_REQUEST',
  'WORKLOG_APPROVED',
  'WORKLOG_REJECTED',
  'TEAM_INVITE',
  'MENTION',
  'SYSTEM',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class CreateNotificationDto {
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

export class FilterNotificationDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

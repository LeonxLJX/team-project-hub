import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  IsString,
  IsUUID,
} from 'class-validator';

export enum ReportType {
  PROJECT = 'project',
  TEAM = 'team',
  USER = 'user',
}

export enum ExportFormat {
  EXCEL = 'excel',
  CSV = 'csv',
}

export class ExportReportDto {
  @IsEnum(ReportType, { message: `type must be one of: ${Object.values(ReportType).join(', ')}` })
  type: ReportType;

  @IsUUID('4', { message: 'targetId must be a valid UUID' })
  @IsNotEmpty({ message: 'targetId is required' })
  targetId: string;

  @IsEnum(ExportFormat, { message: `format must be one of: ${Object.values(ExportFormat).join(', ')}` })
  format: ExportFormat;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  include?: string[];
}

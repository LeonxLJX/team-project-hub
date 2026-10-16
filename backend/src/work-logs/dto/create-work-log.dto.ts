import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  Max,
  IsNumber,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateWorkLogDto {
  @IsUUID('4', { message: 'taskId must be a valid UUID' })
  @IsNotEmpty({ message: 'taskId is required' })
  taskId: string;

  @IsNumber({}, { message: 'hours must be a number' })
  @Min(0.25, { message: 'Hours must be at least 0.25 (15 minutes)' })
  @Max(24, { message: 'Hours cannot exceed 24 per day' })
  hours: number;

  @IsDateString({}, { message: 'logDate must be a valid ISO date string' })
  logDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Description must not exceed 2000 characters' })
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'overtimeHours must be a number' })
  @Min(0)
  overtimeHours?: number;
}

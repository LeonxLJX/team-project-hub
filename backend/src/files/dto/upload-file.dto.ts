import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UploadFileDto {
  @IsUUID('4', { message: 'taskId must be a valid UUID' })
  @IsNotEmpty({ message: 'taskId is required' })
  taskId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** The actual file is sent via multipart/form-data field "file" */
  file?: any;
}

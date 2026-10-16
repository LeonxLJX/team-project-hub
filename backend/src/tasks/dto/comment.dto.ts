import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Comment content is required' })
  @MaxLength(3000, { message: 'Comment must not exceed 3000 characters' })
  content: string;

  @IsOptional()
  @IsUrl({}, { message: 'attachmentUrl must be a valid URL' })
  attachmentUrl?: string;

  @IsOptional()
  @IsString({ each: true })
  mentions?: string[];
}

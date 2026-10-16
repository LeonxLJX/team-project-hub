import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

/**
 * UpdateTaskDto extends CreateTaskDto but makes projectId optional.
 * We omit projectId from the base so it cannot be changed via update,
 * then re-added as optional for flexibility.
 */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['projectId'] as const),
) {}

import { IsInt, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Generic pagination + sorting query DTO. Extend per-resource to add filters.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  /** Field name to sort by (must be allow-listed per resource). */
  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

/**
 * Shape returned by paginated service methods.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

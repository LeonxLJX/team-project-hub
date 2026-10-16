import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateRoleDto {
  @IsEnum(UserRole, {
    message: `Role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role: UserRole;
}

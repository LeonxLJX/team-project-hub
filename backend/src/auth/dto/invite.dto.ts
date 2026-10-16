import { IsEmail, IsEnum, IsUUID, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class InviteDto {
  @IsUUID()
  teamId: string;

  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: `Role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role?: UserRole = UserRole.DEVELOPER;
}

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsString()
  @MinLength(2)
  name: string;
}

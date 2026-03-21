import { IsEnum } from 'class-validator';
import { Role } from '../../../../core/constants/roles.enum';

export class UpdateUserRoleDto {
  @IsEnum(Role)
  role!: Role;
}

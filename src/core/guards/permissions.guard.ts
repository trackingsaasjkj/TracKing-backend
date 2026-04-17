import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../constants/permissions.enum';
import { Role } from '../constants/roles.enum';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user as JwtPayload;

    // ADMIN and SUPER_ADMIN have full access
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) return true;

    // AUX: verify permissions from JWT
    const userPermissions: string[] = user.permissions ?? [];
    const hasAll = required.every((p) => userPermissions.includes(p));

    if (!hasAll) throw new ForbiddenException('Permisos insuficientes');
    return true;
  }
}

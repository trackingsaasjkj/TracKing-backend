import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../constants/roles.enum';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Acceso restringido a SUPER_ADMIN');
    }

    return true;
  }
}

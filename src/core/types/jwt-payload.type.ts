import { Role } from '../constants/roles.enum';

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: Role;
  company_id: string | null;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

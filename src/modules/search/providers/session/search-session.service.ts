import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

interface SessionData {
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
  query?: string;
  city?: string;
}

@Injectable()
export class SearchSessionService {
  private readonly logger = new Logger(SearchSessionService.name);
  private sessions = new Map<string, SessionData>();
  private readonly SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutos

  /**
   * Crea una nueva sesión de búsqueda
   * @param query - Consulta inicial (opcional)
   * @param city - Ciudad (opcional)
   * @returns sessionToken
   */
  createSession(query?: string, city?: string): string {
    const sessionToken = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TTL_MS);

    const session: SessionData = {
      sessionToken,
      createdAt: now,
      expiresAt,
      query,
      city,
    };

    this.sessions.set(sessionToken, session);
    this.logger.log(`Session created: ${sessionToken} | expires in 10 min`);

    return sessionToken;
  }

  /**
   * Valida si una sesión es válida
   * @param sessionToken - Token de sesión
   * @returns true si es válida, false si expiró
   */
  isSessionValid(sessionToken: string): boolean {
    const session = this.sessions.get(sessionToken);

    if (!session) {
      this.logger.warn(`Session not found: ${sessionToken}`);
      return false;
    }

    const now = new Date();
    if (now > session.expiresAt) {
      this.logger.log(`Session expired: ${sessionToken}`);
      this.sessions.delete(sessionToken);
      return false;
    }

    return true;
  }

  /**
   * Obtiene datos de la sesión
   * @param sessionToken - Token de sesión
   * @returns Datos de la sesión o null
   */
  getSession(sessionToken: string): SessionData | null {
    if (!this.isSessionValid(sessionToken)) {
      return null;
    }
    return this.sessions.get(sessionToken) || null;
  }

  /**
   * Finaliza una sesión
   * @param sessionToken - Token de sesión
   */
  endSession(sessionToken: string): void {
    if (this.sessions.has(sessionToken)) {
      this.sessions.delete(sessionToken);
      this.logger.log(`Session ended: ${sessionToken}`);
    }
  }

  /**
   * Limpia sesiones expiradas (ejecutar periódicamente)
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired sessions`);
    }
  }
}

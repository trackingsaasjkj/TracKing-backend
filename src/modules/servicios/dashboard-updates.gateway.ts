import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  namespace: '/dashboard',
  cors: { origin: true, credentials: true },
  pingInterval: 25_000,
  pingTimeout: 10_000,
})
export class DashboardUpdatesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(DashboardUpdatesGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string) ||
        (client.handshake.headers?.authorization as string);

      if (!token) { client.disconnect(); return; }

      const clean = token.replace('Bearer ', '');
      const payload = this.jwtService.verify(clean);

      if (!payload.company_id || !['ADMIN', 'AUX'].includes(payload.role)) {
        client.disconnect();
        return;
      }

      client.join(`company:${payload.company_id}`);
      client.emit('connection:ack', { timestamp: new Date().toISOString() });
      this.logger.log(`[Dashboard WS] ${payload.role} joined company:${payload.company_id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Dashboard WS] Client ${client.id} disconnected`);
  }

  /** Emit when a service status changes */
  emitServiceUpdated(company_id: string, service: Record<string, unknown>) {
    this.server.to(`company:${company_id}`).emit('service:updated', service);
  }

  /** Emit when dashboard metrics change (new service, delivery, etc.) */
  emitDashboardRefresh(company_id: string) {
    this.server.to(`company:${company_id}`).emit('dashboard:refresh');
  }
}

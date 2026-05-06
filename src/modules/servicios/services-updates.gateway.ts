import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';
import { Role } from '../../core/constants/roles.enum';

@Injectable()
@WebSocketGateway({
  namespace: '/services',
  cors: {
    origin: true, // Allow all origins — JWT auth is the security layer
    credentials: true,
  },
  pingInterval: 25_000,  // Send ping every 25s (below Render's 60s TCP timeout)
  pingTimeout: 10_000,   // Disconnect if no pong within 10s
})
export class ServiceUpdatesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ServiceUpdatesGateway.name);

  /** userId → Set of socketIds (supports multiple devices per user) */
  private readonly userSockets = new Map<string, Set<string>>();
  /** socketId → courierId (for cleanup on disconnect) */
  private readonly socketUser = new Map<string, string>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string) ||
        (client.handshake.headers?.authorization as string);

      if (!token) {
        this.logger.warn(`[Services WS] Client ${client.id} rejected: no token`);
        client.disconnect();
        return;
      }

      const clean = token.replace('Bearer ', '');
      const payload = this.jwtService.verify(clean);

      if (payload.role !== Role.COURIER) {
        this.logger.warn(`[Services WS] Client ${client.id} rejected: role=${payload.role}`);
        client.disconnect();
        return;
      }

      const courierId: string = payload.sub;
      const room = `courier:${courierId}`;

      client.join(room);
      this.socketUser.set(client.id, courierId);

      if (!this.userSockets.has(courierId)) {
        this.userSockets.set(courierId, new Set());
      }
      this.userSockets.get(courierId)!.add(client.id);

      client.emit('connection:ack', { courierId, timestamp: new Date().toISOString() });
      this.logger.log(`[Services WS] Courier ${courierId} connected (socket ${client.id})`);
    } catch (err) {
      this.logger.error(`[Services WS] Client ${client.id} rejected: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const courierId = this.socketUser.get(client.id);
    if (courierId) {
      const sockets = this.userSockets.get(courierId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(courierId);
      }
      this.socketUser.delete(client.id);
    }
    this.logger.log(`[Services WS] Client ${client.id} disconnected`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() _data: unknown) {
    client.emit('pong');
  }

  /** Emits a service state update to the courier who owns it */
  emitServiceUpdate(courierId: string, service: Record<string, unknown>): void {
    this.server.to(`courier:${courierId}`).emit('service:updated', service);
  }

  /** Emits a newly assigned service to the target courier */
  emitServiceAssigned(courierId: string, service: Record<string, unknown>): void {
    this.server.to(`courier:${courierId}`).emit('service:assigned', service);
  }

  /** Emits a settlement:created event to the target courier */
  emitSettlementCreated(courierId: string, settlement: Record<string, unknown>): void {
    this.server.to(`courier:${courierId}`).emit('settlement:created', settlement);
  }

  /** Returns the number of active connections for a courier */
  getConnectionCount(courierId: string): number {
    return this.userSockets.get(courierId)?.size ?? 0;
  }
}

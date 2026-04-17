import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

export interface LocationPayload {
  courier_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

@Injectable()
@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3001',
      'https://tracking-xi-seven.vercel.app',
    ],
    credentials: true,
  },
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string);

      if (!token) {
        this.logger.warn(`[Tracking] Client ${client.id} rejected: no token`);
        client.disconnect();
        return;
      }

      const clean = token.replace('Bearer ', '');
      const payload = this.jwtService.verify(clean);

      this.logger.log(`[Tracking] Token payload: role=${payload.role}, company_id=${payload.company_id}`);

      // Admin/AUX join their company room to receive location updates
      if (payload.company_id && ['ADMIN', 'AUX'].includes(payload.role)) {
        client.join(payload.company_id);
        this.logger.log(`Client ${client.id} joined room ${payload.company_id}`);
      } else {
        this.logger.warn(`[Tracking] Client ${client.id} rejected: role=${payload.role} not allowed`);
        client.disconnect();
      }
    } catch (err) {
      this.logger.error(`[Tracking] Client ${client.id} rejected: JWT error — ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Called by RegistrarUbicacionUseCase after saving to DB */
  emitLocation(company_id: string, payload: LocationPayload) {
    this.server.to(company_id).emit('location:updated', payload);
  }
}

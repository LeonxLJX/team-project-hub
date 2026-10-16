import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly connectedClients = new Map<string, string>(); // socketId -> userId

  constructor(private readonly configService: ConfigService) {}

  afterInit() {
    this.logger.log('Notifications WebSocket gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket, ..._args: any[]) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(`Socket ${client.id} connected without a token`);
        client.disconnect(true);
        return;
      }

      const jwtSecret =
        this.configService.get<string>('JWT_SECRET') ?? 'default-secret';
      const payload = jwt.verify(token, jwtSecret) as any;

      if (!payload?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const userId: string = payload.sub;
      client.userId = userId;
      this.connectedClients.set(client.id, userId);

      client.join(`user:${userId}`);

      this.logger.log(
        `Socket ${client.id} connected for user ${userId} (total: ${this.connectedClients.size})`,
      );

      client.emit('connected', { userId, timestamp: new Date().toISOString() });
    } catch (error) {
      this.logger.error(`Socket ${client.id} authentication failed: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);

    if (userId) {
      client.leave(`user:${userId}`);
      this.logger.log(
        `Socket ${client.id} disconnected for user ${userId} (remaining: ${this.connectedClients.size})`,
      );
    } else {
      this.logger.log(`Socket ${client.id} disconnected`);
    }
  }

  emitNotification(userId: string, payload: any): boolean {
    const room = `user:${userId}`;
    const roomSockets = this.server.sockets.adapter.rooms?.get(room);
    const hasClients = roomSockets && roomSockets.size > 0;

    if (hasClients) {
      this.server.to(room).emit('notification', payload);
      this.logger.debug(
        `Emitted notification to user ${userId} (${roomSockets.size} socket(s))`,
      );
      return true;
    }

    this.logger.debug(`User ${userId} is not connected; notification will be fetched on next poll`);
    return false;
  }

  @SubscribeMessage('markAsRead')
  handleMarkAsRead(_client: AuthenticatedSocket, notificationId: string) {
    return { success: true, notificationId };
  }

  getOnlineUserCount(): number {
    return new Set(this.connectedClients.values()).size;
  }
}

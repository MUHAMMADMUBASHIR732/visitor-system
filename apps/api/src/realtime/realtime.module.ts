import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { eq } from 'drizzle-orm';
import type { Server, Socket } from 'socket.io';
import { AuthModule } from '../auth/auth.module';
import { DB, Database } from '../db/db.module';
import { HOST_ROLES, users } from '../db/schema';

@Injectable()
export class RealtimeService {
  server?: Server;

  emitToHost(hostId: string, event: string, payload: unknown) {
    this.server?.to(`host:${hostId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToGate(event: string, payload: unknown) {
    this.server?.to('gate').emit(event, payload);
  }

  /** Every signed-in connection (sockets that fail authentication are disconnected). */
  emitToAll(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }
}

@WebSocketGateway()
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('Realtime');

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Database,
  ) {}

  afterInit(server: Server) {
    this.realtime.server = server;
  }

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth as { token?: string } | undefined)?.token;
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user || !user.isActive) throw new Error('inactive user');

      await client.join(`user:${user.id}`);
      if (HOST_ROLES.includes(user.role)) await client.join(`host:${user.id}`);
      if (user.role === 'GUARD' || user.role === 'ADMIN') await client.join('gate');
    } catch (err) {
      this.logger.debug(`Socket rejected: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }
}

@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimeService, EventsGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}

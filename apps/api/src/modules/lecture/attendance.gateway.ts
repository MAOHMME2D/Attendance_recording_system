import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthorizationService } from '../auth/authorization.service';
import { getAllowedOrigins } from '../../common/utils/origins';
import {
  SESSION_COOKIE_NAME,
  readBearerToken,
  readCookie,
} from '../../common/utils/cookies';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

interface SocketData {
  user?: AuthenticatedUser;
  /**
   * Authentication is asynchronous (it hits the database). Socket.IO may
   * deliver a `lecture:join` message before that lookup finishes, so handlers
   * must await this promise instead of reading `user` too early.
   */
  authPromise?: Promise<void>;
}

@WebSocketGateway({
  cors: {
    // Never use '*' — origins come from CORS_ORIGINS (safe local defaults).
    origin: getAllowedOrigins(),
    credentials: true,
  },
  namespace: '/attendance',
})
export class AttendanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AttendanceGateway.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private authorization: AuthorizationService,
  ) {}

  /**
   * A socket is only accepted after its session cookie/bearer token is
   * validated server-side. Anonymous sockets are disconnected immediately.
   */
  async handleConnection(client: Socket) {
    // Set the promise synchronously so a fast `lecture:join` can await it.
    const data = client.data as SocketData;
    const authPromise = this.authenticateSocket(client);
    data.authPromise = authPromise;
    await authPromise;
  }

  private async authenticateSocket(client: Socket): Promise<void> {
    const data = client.data as SocketData;
    try {
      const headers = client.handshake.headers || {};
      const handshakeToken =
        typeof client.handshake.auth?.token === 'string'
          ? client.handshake.auth.token
          : null;
      const token =
        handshakeToken ||
        readBearerToken(headers.authorization as string | undefined) ||
        readCookie(headers.cookie as string | undefined, SESSION_COOKIE_NAME);

      const user = token ? await this.authService.resolveSession(token) : null;
      if (!user) {
        client.emit('auth:error', { message: 'يجب تسجيل الدخول للاتصال المباشر' });
        client.disconnect(true);
        return;
      }

      data.user = user;
      this.logger.log(`Authenticated client connected: ${client.id} (${user.staffId})`);
    } catch (error) {
      this.logger.warn(`WebSocket authentication failed: ${client.id}`);
      client.emit('auth:error', { message: 'تعذر التحقق من الجلسة' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('lecture:join')
  async handleJoinLecture(client: Socket, payload: { lectureId?: string }) {
    const data = client.data as SocketData;

    // Never trust that connection authentication already finished.
    if (data.authPromise) {
      try {
        await data.authPromise;
      } catch {
        // authenticateSocket already reported the failure.
      }
    }

    const user = data.user;
    if (!user) {
      client.emit('lecture:join:denied', { message: 'غير مصادق' });
      client.disconnect(true);
      return;
    }

    const lectureId = String(payload?.lectureId || '');
    if (!lectureId) {
      client.emit('lecture:join:denied', { message: 'معرف المحاضرة مطلوب' });
      return;
    }

    const lecture = await this.prisma.lecture.findUnique({
      where: { id: lectureId },
      select: { id: true, createdByUserId: true, conductedByUserId: true },
    });

    if (!lecture || !this.authorization.canAccessLecture(user, lecture)) {
      client.emit('lecture:join:denied', {
        message: 'لا تملك صلاحية الانضمام إلى غرفة هذه المحاضرة',
      });
      return;
    }

    // A socket may only watch one lecture at a time.
    for (const room of client.rooms) {
      if (room !== client.id && room.startsWith('lecture:')) {
        client.leave(room);
      }
    }

    client.join(`lecture:${lectureId}`);
    client.emit('lecture:joined', { lectureId });
    this.logger.log(
      `Client ${client.id} (${user.staffId}) joined lecture room: ${lectureId}`,
    );
  }

  /**
   * Emit new attendance registration to all clients in a lecture room
   */
  emitAttendanceNew(lectureId: string, data: any) {
    this.server.to(`lecture:${lectureId}`).emit('attendance:new', data);
  }

  /**
   * Emit QR token refresh
   */
  emitQrRefreshed(lectureId: string, data: any) {
    this.server.to(`lecture:${lectureId}`).emit('qr:refreshed', data);
  }

  /**
   * Emit lecture closed event
   */
  emitLectureClosed(lectureId: string, data: any) {
    this.server.to(`lecture:${lectureId}`).emit('lecture:closed', data);
  }
}

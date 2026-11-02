import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/attendance',
})
export class AttendanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AttendanceGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('lecture:join')
  handleJoinLecture(client: Socket, payload: { lectureId: string }) {
    client.join(`lecture:${payload.lectureId}`);
    this.logger.log(`Client ${client.id} joined lecture room: ${payload.lectureId}`);
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

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/payment',
})
export class PaymentGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  afterInit() {
    this.logger.log('🚀 PaymentGateway initialized at namespace /payment');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.emit('exception', { message: 'Unauthorized: no token' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.data.userId = payload.userId;
      this.logger.log(`✅ Payment socket connected: ${client.data.userId}`);
    } catch {
      client.emit('exception', { message: 'Unauthorized: invalid token' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join_payment')
  async handleJoin(
    @MessageBody() appointmentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const isOwner = await this.verifyOwner(appointmentId, client.data.userId);

    if (!isOwner) {
      client.emit('exception', { message: 'Forbidden' });
      return;
    }

    void client.join(`payment:${appointmentId}`);
    this.logger.log(`Client joined payment:${appointmentId}`);
    client.emit('joined_payment', { appointmentId });
  }

  notifyPaymentStatus(appointmentId: string, status: string) {
    this.server
      .to(`payment:${appointmentId}`)
      .emit('payment_status', { status, appointmentId });
    this.logger.log(
      `Emitted payment_status=${status} → payment:${appointmentId}`,
    );
  }

  private async verifyOwner(
    appointmentId: string,
    userId: string,
  ): Promise<boolean> {
    if (!userId) return false;
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: ['patient', 'patient.user'],
    });
    return appointment?.patient?.user?.id === userId;
  }
}

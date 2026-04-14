import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveCallEntity } from '@/modules/video_call/entities/active-call.entity';

interface ActiveCall {
  userId?: string;
  appointmentId: string;
  roomName: string;
  joinedAt: Date;
}

@Injectable()
export class CallStateService {
  private readonly logger = new Logger(CallStateService.name);

  constructor(
    @InjectRepository(ActiveCallEntity)
    private readonly activeCallRepository: Repository<ActiveCallEntity>,
  ) {}

  /**
   * Set user's current call
   */
  async setCurrentCall(
    userId: string,
    appointmentId: string,
    roomName: string,
  ): Promise<void> {
    await this.activeCallRepository.upsert(
      {
        userId,
        appointmentId,
        roomName,
        joinedAt: new Date(),
      },
      ['userId'],
    );

    this.logger.log(
      `User ${userId} joined call for appointment ${appointmentId}`,
    );
  }

  /**
   * Get user's current call info
   */
  async getCurrentCall(userId: string): Promise<ActiveCall | null> {
    const call = await this.activeCallRepository.findOne({
      where: { userId },
    });

    if (!call) {
      return null;
    }

    return {
      userId: call.userId,
      appointmentId: call.appointmentId,
      roomName: call.roomName,
      joinedAt: call.joinedAt,
    };
  }

  /**
   * Clear user's current call (when leaving)
   */
  async clearCurrentCall(userId: string): Promise<void> {
    const call = await this.getCurrentCall(userId);
    if (call) {
      await this.activeCallRepository.delete({ userId });
      this.logger.log(
        `User ${userId} left call for appointment ${call.appointmentId}`,
      );
    }
  }

  /**
   * Check if user is currently in a call
   */
  async isUserInCall(userId: string): Promise<boolean> {
    return (await this.activeCallRepository.count({ where: { userId } })) > 0;
  }

  /**
   * Get all users currently in a specific appointment call
   */
  async getUsersInCall(appointmentId: string): Promise<string[]> {
    const calls = await this.activeCallRepository.find({
      where: { appointmentId },
      select: ['userId'],
    });
    return calls.map((call) => call.userId);
  }

  /**
   * Clear all calls for a specific appointment
   */
  async clearCallsForAppointment(appointmentId: string): Promise<void> {
    await this.activeCallRepository.delete({ appointmentId });
    this.logger.log(`Cleared all calls for appointment ${appointmentId}`);
  }
}

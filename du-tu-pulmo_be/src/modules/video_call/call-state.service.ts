import { Injectable, Logger } from '@nestjs/common';

interface ActiveCall {
  appointmentId: string;
  roomName: string;
  joinedAt: Date;
}

@Injectable()
export class CallStateService {
  private readonly logger = new Logger(CallStateService.name);

  // In-memory storage for active calls: userId -> ActiveCall
  private activeCalls: Map<string, ActiveCall> = new Map();

  /**
   * Set user's current call
   */
  async setCurrentCall(
    userId: string,
    appointmentId: string,
    roomName: string,
  ): Promise<void> {
    this.activeCalls.set(userId, {
      appointmentId,
      roomName,
      joinedAt: new Date(),
    });
    this.logger.log(
      `User ${userId} joined call for appointment ${appointmentId}`,
    );
  }

  /**
   * Get user's current call info
   */
  async getCurrentCall(userId: string): Promise<ActiveCall | null> {
    return this.activeCalls.get(userId) || null;
  }

  /**
   * Clear user's current call (when leaving)
   */
  async clearCurrentCall(userId: string): Promise<void> {
    const call = this.activeCalls.get(userId);
    if (call) {
      this.activeCalls.delete(userId);
      this.logger.log(
        `User ${userId} left call for appointment ${call.appointmentId}`,
      );
    }
  }

  /**
   * Check if user is currently in a call
   */
  async isUserInCall(userId: string): Promise<boolean> {
    return this.activeCalls.has(userId);
  }

  /**
   * Get all users currently in a specific appointment call
   */
  async getUsersInCall(appointmentId: string): Promise<string[]> {
    const users: string[] = [];
    this.activeCalls.forEach((call, oderId) => {
      if (call.appointmentId === appointmentId) {
        users.push(oderId);
      }
    });
    return users;
  }

  /**
   * Clear all calls for a specific appointment
   */
  async clearCallsForAppointment(appointmentId: string): Promise<void> {
    const usersToRemove: string[] = [];
    this.activeCalls.forEach((call, oderId) => {
      if (call.appointmentId === appointmentId) {
        usersToRemove.push(oderId);
      }
    });
    usersToRemove.forEach((userId) => this.activeCalls.delete(userId));
    this.logger.log(`Cleared all calls for appointment ${appointmentId}`);
  }
}

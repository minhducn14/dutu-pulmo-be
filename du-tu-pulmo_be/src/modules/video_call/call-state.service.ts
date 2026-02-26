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
  setCurrentCall(
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
    return Promise.resolve();
  }

  /**
   * Get user's current call info
   */
  getCurrentCall(userId: string): Promise<ActiveCall | null> {
    return Promise.resolve(this.activeCalls.get(userId) || null);
  }

  /**
   * Clear user's current call (when leaving)
   */
  clearCurrentCall(userId: string): Promise<void> {
    const call = this.activeCalls.get(userId);
    if (call) {
      this.activeCalls.delete(userId);
      this.logger.log(
        `User ${userId} left call for appointment ${call.appointmentId}`,
      );
    }
    return Promise.resolve();
  }

  /**
   * Check if user is currently in a call
   */
  isUserInCall(userId: string): Promise<boolean> {
    return Promise.resolve(this.activeCalls.has(userId));
  }

  /**
   * Get all users currently in a specific appointment call
   */
  getUsersInCall(appointmentId: string): Promise<string[]> {
    const users: string[] = [];
    this.activeCalls.forEach((call, oderId) => {
      if (call.appointmentId === appointmentId) {
        users.push(oderId);
      }
    });
    return Promise.resolve(users);
  }

  /**
   * Clear all calls for a specific appointment
   */
  clearCallsForAppointment(appointmentId: string): Promise<void> {
    const usersToRemove: string[] = [];
    this.activeCalls.forEach((call, oderId) => {
      if (call.appointmentId === appointmentId) {
        usersToRemove.push(oderId);
      }
    });
    usersToRemove.forEach((userId) => this.activeCalls.delete(userId));
    this.logger.log(`Cleared all calls for appointment ${appointmentId}`);
    return Promise.resolve();
  }
}

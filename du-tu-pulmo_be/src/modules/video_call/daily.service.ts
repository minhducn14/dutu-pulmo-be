import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface DailyRoom {
  id: string;
  name: string;
  api_created: boolean;
  privacy: string;
  url: string;
  created_at: string;
  config: Record<string, unknown>;
}

export interface DailyMeetingToken {
  token: string;
}

@Injectable()
export class DailyService {
  private readonly logger = new Logger(DailyService.name);
  private readonly apiUrl = 'https://api.daily.co/v1';
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('DAILY_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('DAILY_API_KEY is not configured');
    }
  }

  /**
   * Get headers for Daily.co API requests
   */
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * Get or create a Daily.co room for an appointment
   * Room name format: appointment-{appointmentId}
   */
  async getOrCreateRoom(appointmentId: string): Promise<DailyRoom> {
    const roomName = `appointment-${appointmentId}`;

    try {
      // Try to get existing room first
      const existingRoom = await this.getRoom(roomName);
      if (existingRoom) {
        this.logger.log(`Found existing room: ${roomName}`);
        return existingRoom;
      }
    } catch (error) {
      // Room doesn't exist, we'll create it
      this.logger.debug(`Room ${roomName} not found, creating new one`);
    }

    // Create new room
    return this.createRoom(roomName);
  }

  /**
   * Get an existing room by name
   */
  async getRoom(roomName: string): Promise<DailyRoom | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<DailyRoom>(`${this.apiUrl}/rooms/${roomName}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new Daily.co room
   */
  async createRoom(roomName: string): Promise<DailyRoom> {
    const response = await firstValueFrom(
      this.httpService.post<DailyRoom>(
        `${this.apiUrl}/rooms`,
        {
          name: roomName,
          privacy: 'private',
          properties: {
            enable_chat: true,
            enable_screenshare: true,
            enable_recording: 'cloud',
            start_video_off: false,
            start_audio_off: false,
            exp: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours
          },
        },
        { headers: this.getHeaders() },
      ),
    );

    this.logger.log(`Created new room: ${roomName}`);
    return response.data;
  }

  /**
   * Delete a Daily.co room
   */
  async deleteRoom(roomName: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.apiUrl}/rooms/${roomName}`, {
          headers: this.getHeaders(),
        }),
      );
      this.logger.log(`Deleted room: ${roomName}`);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status !== 404) {
        throw error;
      }
      this.logger.debug(`Room ${roomName} already deleted or doesn't exist`);
    }
  }

  /**
   * Create a meeting token for a participant
   * @param roomName - The room name
   * @param userId - The user ID
   * @param userName - The user's display name
   * @param isOwner - Whether the user is the room owner (doctor)
   */
  async createMeetingToken(
    roomName: string,
    userId: string,
    userName: string,
    isOwner: boolean = false,
  ): Promise<DailyMeetingToken> {
    const response = await firstValueFrom(
      this.httpService.post<DailyMeetingToken>(
        `${this.apiUrl}/meeting-tokens`,
        {
          properties: {
            room_name: roomName,
            user_id: userId,
            user_name: userName,
            is_owner: isOwner,
            enable_recording: isOwner ? 'cloud' : undefined,
            exp: Math.floor(Date.now() / 1000) + 3600, // Token expires in 1 hour
          },
        },
        { headers: this.getHeaders() },
      ),
    );

    this.logger.log(
      `Created meeting token for user ${userId} in room ${roomName}`,
    );
    return response.data;
  }
}

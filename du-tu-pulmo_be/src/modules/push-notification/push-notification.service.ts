import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Notification } from '@/modules/notification/entities/notification.entity';
import { UserService } from '@/modules/user/user.service';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    if (admin.apps.length) {
      this.isInitialized = true;
      return;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.error(
        'Firebase initialization FAILED — missing credentials:\n' +
        `  FIREBASE_PROJECT_ID: ${projectId ? '✓' : '✗ MISSING'}\n` +
        `  FIREBASE_PRIVATE_KEY: ${privateKey ? '✓' : '✗ MISSING'}\n` +
        `  FIREBASE_CLIENT_EMAIL: ${clientEmail ? '✓' : '✗ MISSING'}`,
      );
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
      });
      this.isInitialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error(`Firebase initializeApp() threw: ${error.message}`, error.stack);
    }
  }

  private assertInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'Firebase is not initialized. Check your FIREBASE_* environment variables.',
      );
    }
  }

  async sendToDevice(token: string, payload: NotificationPayload): Promise<boolean> {
    this.assertInitialized();
    try {
      const message: admin.messaging.Message = {
        token,
        // notification: { title: payload.title, body: payload.body },
        data: {
          title: payload.title,
          body: payload.body,
          ...(payload.data || {})
        } 
      };
      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message to device: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending message to device: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Send a push notification to multiple devices.
   * Returns an array of tokens that failed to receive the message.
   */
  async sendMulticast(tokens: string[], payload: NotificationPayload): Promise<string[]> {
    this.assertInitialized();
    if (!tokens || tokens.length === 0) return [];
    
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        // notification: {
        //   title: payload.title,
        //   body: payload.body,
        // },
        data: {
          title: payload.title,
          body: payload.body,
          ...(payload.data || {})
        } 
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(`Successfully sent multicast message. Success count: ${response.successCount}, Failure count: ${response.failureCount}`);
      
      const failedTokens: string[] = [];
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            this.logger.warn(`Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });
      }
      return failedTokens;
    } catch (error) {
      this.logger.error(`Error sending multicast message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send a push notification to a topic.
   */
  async sendToTopic(topic: string, payload: NotificationPayload): Promise<boolean> {
    try {
      const message: admin.messaging.Message = {
        topic,
        // notification: {
        //   title: payload.title,
        //   body: payload.body,
        // },
        data: {
          title: payload.title,
          body: payload.body,
          ...(payload.data || {})
        } 
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message to topic ${topic}: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending message to topic ${topic}: ${error.message}`, error.stack);
      return false;
    }
  }

  @OnEvent('notification.created')
  async handleNotificationCreated(notification: Notification) {
    this.logger.log(`Received notification.created event for user ${notification.userId}`);
    
    try {
      // Fetch user entity to get FCM tokens
      const result = await this.userService.findOne(notification.userId);
      const user = result.data;
      
      if (!user || (!user.fcmTokens?.length)) {
        this.logger.debug(`User ${notification.userId} has no FCM tokens. Skipping push notification.`);
        return;
      }
      
      const payload: NotificationPayload = {
        title: notification.title,
        body: notification.content,
        data: {
          title: notification.title,
          body: notification.content,
          id: String(notification.id),
          userId: String(notification.userId),
          type: String(notification.type),
          refId: notification.refId ? String(notification.refId) : "",
        } 
      };

      // Send multicast push
      const failedTokens = await this.sendMulticast(user.fcmTokens, payload);
      
      // Cleanup tokens that failed (e.g. token_not_registered)
      if (failedTokens.length > 0) {
        this.logger.log(`Cleaning up ${failedTokens.length} failed FCM tokens for user ${user.id}`);
        for (const token of failedTokens) {
          await this.userService.removeFcmToken(user.id, token);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling notification.created event: ${error.message}`, error.stack);
    }
  }
}

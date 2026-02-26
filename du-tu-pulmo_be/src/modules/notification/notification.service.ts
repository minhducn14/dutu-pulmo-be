import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '@/modules/email/email.service';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '@/modules/notification/entities/notification.entity';
import { StatusEnum } from '@/modules/common/enums/status.enum';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

export type CancellationReason = 'SCHEDULE_CHANGE' | 'TIME_OFF';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Lấy danh sách thông báo của 1 user có phân trang
   */
  async findUserNotifications(userId: string, query: PaginationDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.notificationRepository.update(
      { id: notificationId, userId },
      { status: StatusEnum.ACTIVE }, // ACTIVE = Đã đọc
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Tạo một thông báo chung (Generic) lưu vào DB
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      content: dto.content,
      status: dto.status ?? StatusEnum.PENDING,
      refId: dto.refId ?? null,
      refType: dto.refType ?? null,
    });

    // Save to DB
    const saved = await this.notificationRepository.save(notification);
    this.logger.log(`Created notification ${saved.id} for user ${dto.userId}`);
    return saved;
  }

  /**
   * Đánh dấu toàn bộ thông báo của 1 user là đã đọc
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    const result = await this.notificationRepository.update(
      { userId, status: StatusEnum.PENDING }, // PENDING = Chưa đọc
      { status: StatusEnum.ACTIVE },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Notify patients about cancelled appointments
   * Runs asynchronously - does not block the caller
   */
  async notifyCancelledAppointments(
    appointments: Appointment[],
    reason: CancellationReason,
  ): Promise<void> {
    if (appointments.length === 0) {
      return;
    }

    this.logger.log(
      `Sending cancellation notifications for ${appointments.length} appointments (reason: ${reason})`,
    );

    const results = await Promise.allSettled(
      appointments.map(async (apt) => {
        // Send Email
        await this.sendCancellationEmail(apt, reason);

        // Notify Patient in-app
        const patientUserId = apt.patient?.user?.id;
        if (!patientUserId) {
          this.logger.warn(
            `Cannot create in-app notification - missing patient.user.id for appointment ${apt.id}`,
          );
        } else {
          await this.createNotification({
            userId: patientUserId,
            type: NotificationTypeEnum.APPOINTMENT,
            title: 'Lịch hẹn đã bị hủy',
            content: `Lịch hẹn mã ${apt.appointmentNumber} của bạn đã bị hủy do ${reason === 'TIME_OFF' ? 'bác sĩ có lịch nghỉ phép' : 'sự thay đổi lịch làm việc'}.`,
            refId: apt.id,
            refType: 'APPOINTMENT',
          });
        }

        // Notify Doctor in-app
        const doctorUserId = apt.doctor?.user?.id;
        if (!doctorUserId) {
          this.logger.warn(
            `Cannot create in-app notification - missing doctor.user.id for appointment ${apt.id}`,
          );
        } else {
          await this.createNotification({
            userId: doctorUserId,
            type: NotificationTypeEnum.APPOINTMENT,
            title: 'Hệ thống đã hủy lịch hẹn',
            content: `Hệ thống đã tự động hủy lịch hẹn mã ${apt.appointmentNumber} do lịch làm việc của bạn có sự thay đổi.`,
            refId: apt.id,
            refType: 'APPOINTMENT',
          });
        }
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Cancellation notifications: ${succeeded} sent, ${failed} failed`,
    );
  }

  /**
   * Send cancellation email to a patient
   */
  private async sendCancellationEmail(
    appointment: Appointment,
    reason: CancellationReason,
  ): Promise<void> {
    try {
      // Get patient email from relation
      const patientEmail = appointment.patient?.user?.account?.email;
      const patientName = appointment.patient?.user?.fullName || 'Quý khách';
      const doctorName = appointment.doctor?.user?.fullName || 'Bác sĩ';

      if (!patientEmail) {
        this.logger.warn(
          `Cannot send notification - no email for appointment ${appointment.id}`,
        );
        return;
      }

      const reasonText =
        reason === 'TIME_OFF'
          ? 'bác sĩ có lịch nghỉ phép'
          : 'có thay đổi lịch làm việc của bác sĩ';

      const scheduledAt = new Date(appointment.scheduledAt);
      const dateStr = scheduledAt.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = scheduledAt.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const html = this.getCancellationEmailTemplate(
        patientName,
        doctorName,
        dateStr,
        timeStr,
        reasonText,
        appointment.appointmentNumber,
      );

      // Use the existing email transporter pattern
      await this.emailService['transporter'].sendMail({
        from: `"DuTu Pulmo Support" <${process.env.SMTP_USER}>`,
        to: patientEmail,
        subject: `Thông báo hủy lịch hẹn - ${appointment.appointmentNumber}`,
        html,
      });

      this.logger.log(
        `Sent cancellation email to ${patientEmail} for appointment ${appointment.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation email for appointment ${appointment.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * HTML template for cancellation email
   */
  private getCancellationEmailTemplate(
    patientName: string,
    doctorName: string,
    dateStr: string,
    timeStr: string,
    reasonText: string,
    appointmentNumber: string,
  ): string {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Thông báo hủy lịch hẹn</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 32px;
          font-weight: bold;
          color: #071658;
          margin-bottom: 10px;
        }
        .warning-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          color: #dc3545;
          font-size: 24px;
          margin-bottom: 20px;
        }
        .info-box {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .detail-box {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-item {
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .detail-item:last-child {
          border-bottom: none;
        }
        .label {
          color: #666;
          font-size: 14px;
        }
        .value {
          color: #333;
          font-weight: bold;
          font-size: 16px;
        }
        .action-box {
          background-color: #e3f2fd;
          border-left: 4px solid #2196F3;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🫁 DuTu Pulmo</div>
          <div class="warning-icon">⚠️</div>
        </div>
        
        <h1>Thông báo hủy lịch hẹn</h1>
        
        <p>Xin chào <strong>${patientName}</strong>,</p>
        
        <p>Chúng tôi rất tiếc phải thông báo rằng lịch hẹn khám của bạn đã bị hủy do <strong>${reasonText}</strong>.</p>
        
        <div class="detail-box">
          <div class="detail-item">
            <div class="label">Mã lịch hẹn</div>
            <div class="value">${appointmentNumber}</div>
          </div>
          <div class="detail-item">
            <div class="label">Bác sĩ</div>
            <div class="value">${doctorName}</div>
          </div>
          <div class="detail-item">
            <div class="label">Thời gian đã hẹn</div>
            <div class="value">${timeStr}, ${dateStr}</div>
          </div>
        </div>
        
        <div class="action-box">
          <strong>💡 Bạn có thể:</strong>
          <ul>
            <li>Đặt lịch hẹn mới với bác sĩ khác</li>
            <li>Đặt lại lịch hẹn với bác sĩ này vào ngày khác</li>
            <li>Liên hệ hotline để được hỗ trợ</li>
          </ul>
        </div>
        
        <div class="info-box">
          <strong>💰 Hoàn tiền:</strong>
          <p style="margin: 10px 0 0 0;">Nếu bạn đã thanh toán, số tiền sẽ được hoàn lại trong vòng 3-5 ngày làm việc.</p>
        </div>
        
        <p>Chúng tôi thành thật xin lỗi vì sự bất tiện này và mong được phục vụ bạn trong thời gian sớm nhất.</p>
        
        <div class="footer">
          <p>Cần hỗ trợ? Liên hệ: <a href="mailto:support@dutupulmo.vn">support@dutupulmo.vn</a></p>
          <p>Hotline: 1900-xxxx-xx</p>
          <p>&copy; 2025 DuTu Pulmo. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  // ========================================
  // SCHEDULE CHANGE WARNING NOTIFICATION
  // ========================================

  /**
   * Gửi thông báo cảnh báo cho bệnh nhân về thay đổi lịch làm việc
   * KHÔNG hủy appointments, chỉ cảnh báo để bệnh nhân/bác sĩ tự xử lý
   */
  async notifyScheduleChangeWarning(
    appointments: Appointment[],
    changeInfo: {
      scheduleId: string;
      oldDayOfWeek: number;
      newDayOfWeek: number;
      oldStartTime: string;
      newStartTime: string;
      oldEndTime: string;
      newEndTime: string;
      effectiveFrom: Date;
    },
  ): Promise<void> {
    if (appointments.length === 0) {
      return;
    }

    this.logger.log(
      `Sending schedule change warning notifications for ${appointments.length} appointments`,
    );

    const results = await Promise.allSettled(
      appointments.map(async (apt) => {
        // Send Warning Email
        await this.sendScheduleChangeWarningEmail(apt, changeInfo);

        // Notify Patient in-app
        const patientUserId = apt.patient?.user?.id;
        const effectiveFromStr =
          changeInfo.effectiveFrom.toLocaleDateString('vi-VN');

        if (!patientUserId) {
          this.logger.warn(
            `Cannot create in-app notification - missing patient.user.id for appointment ${apt.id}`,
          );
        } else {
          await this.createNotification({
            userId: patientUserId,
            type: NotificationTypeEnum.APPOINTMENT,
            title: 'Cảnh báo thay đổi lịch làm việc',
            content: `Bác sĩ ${apt.doctor?.user?.fullName || ''} đã thay đổi lịch làm việc từ ${effectiveFromStr}. Vui lòng kiểm tra lại lịch hẹn mã ${apt.appointmentNumber} của bạn.`,
            refId: apt.id,
            refType: 'APPOINTMENT',
          });
        }

        // Notify Doctor in-app
        const doctorUserId = apt.doctor?.user?.id;
        if (!doctorUserId) {
          this.logger.warn(
            `Cannot create in-app notification - missing doctor.user.id for appointment ${apt.id}`,
          );
        } else {
          await this.createNotification({
            userId: doctorUserId,
            type: NotificationTypeEnum.APPOINTMENT,
            title: 'Lịch làm việc của bạn đã được cập nhật',
            content: `Lịch làm việc của bạn đã thay đổi từ ${effectiveFromStr}. Lịch hẹn mã ${apt.appointmentNumber} có thể bị ảnh hưởng.`,
            refId: apt.id,
            refType: 'APPOINTMENT',
          });
        }
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Schedule change warning notifications: ${succeeded} sent, ${failed} failed`,
    );
  }

  /**
   * Gửi email cảnh báo về thay đổi lịch làm việc
   */
  private async sendScheduleChangeWarningEmail(
    appointment: Appointment,
    changeInfo: {
      scheduleId: string;
      oldDayOfWeek: number;
      newDayOfWeek: number;
      oldStartTime: string;
      newStartTime: string;
      oldEndTime: string;
      newEndTime: string;
      effectiveFrom: Date;
    },
  ): Promise<void> {
    try {
      const patientEmail = appointment.patient?.user?.account?.email;
      const patientName = appointment.patient?.user?.fullName || 'Quý khách';
      const doctorName = appointment.doctor?.user?.fullName || 'Bác sĩ';

      if (!patientEmail) {
        this.logger.warn(
          `Cannot send warning notification - no email for appointment ${appointment.id}`,
        );
        return;
      }

      const scheduledAt = new Date(appointment.scheduledAt);
      const dateStr = scheduledAt.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = scheduledAt.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const dayNames = [
        'Chủ nhật',
        'Thứ 2',
        'Thứ 3',
        'Thứ 4',
        'Thứ 5',
        'Thứ 6',
        'Thứ 7',
      ];
      const effectiveFromStr =
        changeInfo.effectiveFrom.toLocaleDateString('vi-VN');

      const html = this.getScheduleChangeWarningEmailTemplate(
        patientName,
        doctorName,
        dateStr,
        timeStr,
        appointment.appointmentNumber,
        {
          oldDay: dayNames[changeInfo.oldDayOfWeek],
          newDay: dayNames[changeInfo.newDayOfWeek],
          oldTime: `${changeInfo.oldStartTime} - ${changeInfo.oldEndTime}`,
          newTime: `${changeInfo.newStartTime} - ${changeInfo.newEndTime}`,
          effectiveFrom: effectiveFromStr,
        },
      );

      await this.emailService['transporter'].sendMail({
        from: `"DuTu Pulmo Support" <${process.env.SMTP_USER}>`,
        to: patientEmail,
        subject: `⚠️ Thông báo thay đổi lịch làm việc - Lịch hẹn ${appointment.appointmentNumber}`,
        html,
      });

      this.logger.log(
        `Sent schedule change warning email to ${patientEmail} for appointment ${appointment.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send schedule change warning email for appointment ${appointment.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Template email cảnh báo thay đổi lịch làm việc
   */
  private getScheduleChangeWarningEmailTemplate(
    patientName: string,
    doctorName: string,
    dateStr: string,
    timeStr: string,
    appointmentNumber: string,
    changes: {
      oldDay: string;
      newDay: string;
      oldTime: string;
      newTime: string;
      effectiveFrom: string;
    },
  ): string {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Thông báo thay đổi lịch làm việc</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 32px;
          font-weight: bold;
          color: #071658;
          margin-bottom: 10px;
        }
        .warning-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          color: #f59e0b;
          font-size: 24px;
          margin-bottom: 20px;
        }
        .warning-box {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .detail-box {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-item {
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .detail-item:last-child {
          border-bottom: none;
        }
        .label {
          color: #666;
          font-size: 14px;
        }
        .value {
          color: #333;
          font-weight: bold;
          font-size: 16px;
        }
        .change-box {
          background-color: #fef3c7;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .change-item {
          display: flex;
          align-items: center;
          padding: 10px 0;
        }
        .old-value {
          color: #dc3545;
          text-decoration: line-through;
          margin-right: 10px;
        }
        .new-value {
          color: #28a745;
          font-weight: bold;
        }
        .action-box {
          background-color: #e3f2fd;
          border-left: 4px solid #2196F3;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🫁 DuTu Pulmo</div>
          <div class="warning-icon">⚠️</div>
        </div>
        
        <h1>Thông báo thay đổi lịch làm việc</h1>
        
        <p>Xin chào <strong>${patientName}</strong>,</p>
        
        <div class="warning-box">
          <strong>⚠️ CẢNH BÁO:</strong>
          <p style="margin: 10px 0 0 0;">Lịch làm việc của bác sĩ đã thay đổi và có thể ảnh hưởng đến lịch hẹn của bạn. Vui lòng kiểm tra và liên hệ với chúng tôi nếu cần đặt lại lịch.</p>
        </div>
        
        <p>Lịch hẹn của bạn:</p>
        
        <div class="detail-box">
          <div class="detail-item">
            <div class="label">Mã lịch hẹn</div>
            <div class="value">${appointmentNumber}</div>
          </div>
          <div class="detail-item">
            <div class="label">Bác sĩ</div>
            <div class="value">${doctorName}</div>
          </div>
          <div class="detail-item">
            <div class="label">Thời gian đã hẹn</div>
            <div class="value">${timeStr}, ${dateStr}</div>
          </div>
        </div>
        
        <p><strong>Thay đổi lịch làm việc (áp dụng từ ${changes.effectiveFrom}):</strong></p>
        
        <div class="change-box">
          <div class="change-item">
            <span class="label" style="width: 100px;">Ngày làm việc:</span>
            <span class="old-value">${changes.oldDay}</span>
            <span>→</span>
            <span class="new-value">${changes.newDay}</span>
          </div>
          <div class="change-item">
            <span class="label" style="width: 100px;">Giờ làm việc:</span>
            <span class="old-value">${changes.oldTime}</span>
            <span>→</span>
            <span class="new-value">${changes.newTime}</span>
          </div>
        </div>
        
        <div class="action-box">
          <strong>💡 Bạn cần:</strong>
          <ul>
            <li>Kiểm tra xem lịch hẹn của bạn có nằm trong khung giờ mới không</li>
            <li>Nếu không phù hợp, vui lòng liên hệ để đặt lại lịch</li>
            <li>Hoặc đặt lịch với bác sĩ khác nếu cần</li>
          </ul>
        </div>
        
        <p>Chúng tôi xin lỗi vì sự bất tiện này và sẵn sàng hỗ trợ bạn.</p>
        
        <div class="footer">
          <p>Cần hỗ trợ? Liên hệ: <a href="mailto:support@dutupulmo.vn">support@dutupulmo.vn</a></p>
          <p>Hotline: 1900-xxxx-xx</p>
          <p>&copy; 2025 DuTu Pulmo. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}

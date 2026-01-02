import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Send verification email for new user registration
   */
  async sendVerificationEmail(
    to: string,
    verificationToken: string,
    userName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: `"DuTu Pulmo Support" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: 'Xác thực tài khoản DuTu Pulmo của bạn',
      html: this.getVerificationEmailTemplate(verificationUrl, userName),
      text: this.getVerificationPlainText(verificationUrl, userName),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}:`, error);
      throw new Error('Không thể gửi email xác thực. Vui lòng thử lại sau.');
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(
    to: string,
    verificationToken: string,
    userName: string,
  ): Promise<void> {
    await this.sendVerificationEmail(to, verificationToken, userName);
  }

  /**
   * Send reset password email
   */
  async sendResetPasswordEmail(
    to: string,
    resetToken: string,
    userName?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"DuTu Pulmo Support" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: 'Reset Mật Khẩu - DuTu Pulmo',
      html: this.getResetPasswordTemplate(resetUrl, userName),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Reset password email sent to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error('Không thể gửi email. Vui lòng thử lại sau.');
    }
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '';

    const mailOptions = {
      from: `"DuTu Pulmo Support" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: 'Chào mừng bạn đến với DuTu Pulmo! 🎉',
      html: this.getWelcomeEmailTemplate(userName, frontendUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}:`, error);
      // Don't throw error for welcome email - it's not critical
    }
  }

  /**
   * Verification email template
   */
  private getVerificationEmailTemplate(verificationUrl: string, userName: string): string {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Xác thực tài khoản</title>
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
        .emoji {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          color: #333;
          font-size: 24px;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 15px;
          font-size: 16px;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .verify-button {
          display: inline-block;
          padding: 15px 40px;
          background-color: #071658;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        .verify-button:hover {
          background-color: #05103d;
        }
        .info-box {
          background-color: #e3f2fd;
          border-left: 4px solid #2196F3;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info-box ul {
          margin: 10px 0 0 0;
          padding-left: 20px;
        }
        .info-box li {
          margin: 5px 0;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
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
        .link {
          color: #071658;
          word-break: break-all;
          font-size: 14px;
        }
        .divider {
          border-top: 1px solid #eee;
          margin: 30px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🫁 DuTu Pulmo</div>
          <div class="emoji">✉️</div>
        </div>
        
        <h1>Xác thực địa chỉ email của bạn</h1>
        
        <p>Xin chào <strong>${userName}</strong>,</p>
        
        <p>Cảm ơn bạn đã đăng ký tài khoản với <strong>DuTu Pulmo</strong>! Chúng tôi rất vui mừng được đồng hành cùng bạn trong hành trình chăm sóc sức khỏe phổi.</p>
        
        <p>Để hoàn tất quá trình đăng ký và bắt đầu sử dụng dịch vụ, vui lòng xác thực địa chỉ email của bạn bằng cách nhấn vào nút bên dưới:</p>
        
        <div class="button-container">
          <a href="${verificationUrl}" class="verify-button">✓ Xác thực tài khoản</a>
        </div>
        
        <div class="info-box">
          <strong>⏰ Thông tin quan trọng:</strong>
          <ul>
            <li>Link xác thực có hiệu lực trong <strong>24 giờ</strong></li>
            <li>Link chỉ có thể sử dụng <strong>một lần</strong></li>
            <li>Sau khi xác thực, bạn có thể đăng nhập và sử dụng đầy đủ tính năng</li>
          </ul>
        </div>
        
        <div class="divider"></div>
        
        <p><a href="${verificationUrl}" target="_blank" class="link">👉 Click vào đây để xác thực tài khoản</a></p>
        
        <div class="divider"></div>
        
        <div class="warning">
          <strong>🔒 Bảo mật:</strong>
          <p style="margin: 10px 0 0 0;">Nếu bạn không yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email này. Tài khoản sẽ không được kích hoạt nếu không có xác thực.</p>
        </div>
        
        <div class="footer">
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          <p>Nếu bạn cần hỗ trợ, vui lòng liên hệ: <a href="mailto:support@dutupulmo.vn">support@dutupulmo.vn</a></p>
          <p>&copy; 2025 DuTu Pulmo. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Plain text version for verification email
   */
  private getVerificationPlainText(verificationUrl: string, userName: string): string {
    return `
Xin chào ${userName},

Cảm ơn bạn đã đăng ký tài khoản với DuTu Pulmo!

Để xác thực tài khoản của bạn, vui lòng truy cập link sau:
${verificationUrl}

Thông tin quan trọng:
- Link này có hiệu lực trong 24 giờ
- Link chỉ có thể sử dụng một lần
- Sau khi xác thực, bạn có thể đăng nhập và sử dụng đầy đủ tính năng

Nếu bạn không yêu cầu đăng ký này, vui lòng bỏ qua email này.

---
DuTu Pulmo
Hỗ trợ: support@dutupulmo.vn
© 2025 DuTu Pulmo. All rights reserved.
    `;
  }

  /**
   * Welcome email template (sent after successful verification)
   */
  private getWelcomeEmailTemplate(userName: string, frontendUrl: string): string {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chào mừng bạn</title>
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
        .emoji {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #333;
          font-size: 28px;
          margin-bottom: 20px;
          text-align: center;
        }
        p {
          margin-bottom: 15px;
          font-size: 16px;
        }
        .feature-box {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .feature-item {
          padding: 15px;
          margin: 10px 0;
          background-color: #fff;
          border-radius: 5px;
          border-left: 4px solid #071658;
        }
        .feature-item strong {
          color: #071658;
          font-size: 18px;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .cta-button {
          display: inline-block;
          padding: 15px 40px;
          background-color: #071658;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        .cta-button:hover {
          background-color: #05103d;
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
          <div class="emoji">🎉</div>
        </div>
        
        <h1>Chào mừng đến với DuTu Pulmo!</h1>
        
        <p>Xin chào <strong>${userName}</strong>,</p>
        
        <p>Tài khoản của bạn đã được xác thực thành công! Giờ đây bạn có thể trải nghiệm đầy đủ các dịch vụ chẩn đoán bệnh phổi của chúng tôi.</p>
        
        <div class="feature-box">
          <h3 style="margin-top: 0; color: #071658;">Những gì bạn có thể làm với DuTu Pulmo:</h3>
          
          <div class="feature-item">
            <strong>🫁 Chẩn đoán bệnh phổi</strong>
            <p style="margin: 5px 0 0 0; color: #666;">Phân tích X-quang phổi bằng AI để phát hiện các bệnh lý</p>
          </div>
          
          <div class="feature-item">
            <strong>📊 Theo dõi sức khỏe phổi</strong>
            <p style="margin: 5px 0 0 0; color: #666;">Lưu trữ và theo dõi lịch sử chẩn đoán, kết quả X-quang</p>
          </div>
          
          <div class="feature-item">
            <strong>👨‍⚕️ Tư vấn chuyên gia</strong>
            <p style="margin: 5px 0 0 0; color: #666;">Nhận tư vấn từ các bác sĩ chuyên khoa hô hấp</p>
          </div>
          
          <div class="feature-item">
            <strong>📱 Thông báo kết quả</strong>
            <p style="margin: 5px 0 0 0; color: #666;">Nhận thông báo ngay khi có kết quả chẩn đoán</p>
          </div>
        </div>
        
        <div class="button-container">
          <a href="${frontendUrl}/dashboard" class="cta-button">Bắt đầu sử dụng ngay</a>
        </div>
        
        <p style="text-align: center; color: #666; margin-top: 30px;">
          Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi!
        </p>
        
        <div class="footer">
          <p>Cảm ơn bạn đã tin tưởng DuTu Pulmo! 💙</p>
          <p>Hỗ trợ 24/7: <a href="mailto:support@dutupulmo.vn">support@dutupulmo.vn</a></p>
          <p>&copy; 2025 DuTu Pulmo. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Reset password email template
   */
  private getResetPasswordTemplate(resetUrl: string, userName?: string): string {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Mật Khẩu</title>
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
        h1 {
          color: #333;
          font-size: 24px;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 15px;
          font-size: 16px;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .reset-button {
          display: inline-block;
          padding: 15px 40px;
          background-color: #071658;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        .reset-button:hover {
          background-color: #071658;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
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
        .link {
          color: #4CAF50;
          word-break: break-all;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🫁 DuTu Pulmo</div>
        </div>
        
        <h1>Yêu cầu đặt lại mật khẩu</h1>
        
        <p>Xin chào ${userName || 'bạn'},</p>
        
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản DuTu Pulmo của bạn. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        
        <div class="button-container">
          <a href="${resetUrl}" class="reset-button">Đặt lại mật khẩu</a>
        </div>
        
        <div class="warning">
          <strong>⚠️ Lưu ý quan trọng:</strong>
          <ul>
            <li>Link này chỉ có hiệu lực trong <strong>1 giờ</strong></li>
            <li>Link chỉ có thể sử dụng <strong>một lần</strong></li>
            <li>Không chia sẻ link này với bất kỳ ai</li>
          </ul>
        </div>
        
        <p><a href="${resetUrl}" target="_blank" class="link">👉 Click vào đây để đặt lại mật khẩu</a></p>
        
        <div class="footer">
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          <p>Nếu bạn cần hỗ trợ, vui lòng liên hệ: <a href="mailto:support@dutupulmo.vn">support@dutupulmo.vn</a></p>
          <p>&copy; 2025 DuTu Pulmo. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}
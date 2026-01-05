import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Specialty } from 'src/modules/common/enums/specialty.enum';
import { DoctorTitle } from 'src/modules/common/enums/doctor-title.enum';
import { UserStatusEnum } from '../../common/enums/user-status.enum';
import { GenderEnum } from '../../common/enums/gender.enum';
import { VerificationStatus } from 'src/modules/common/enums/doctor-verification-status.enum';

export class DoctorResponseDto {
  // ====== Doctor base ======
  @ApiProperty({
    example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123',
    description: 'ID của bác sĩ',
  })
  id: string;

  @ApiProperty({
    example: 'a7c1cf97-6734-43ae-9a62-0f97b48f5000',
    description: 'User ID liên kết với bác sĩ',
  })
  userId: string;

  // ====== User profile (thường lấy từ doctor.user) ======
  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Họ tên đầy đủ',
  })
  fullName?: string;

  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Số điện thoại',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Ngày sinh',
  })
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    enum: GenderEnum,
    example: GenderEnum.MALE,
    description: 'Giới tính',
  })
  gender?: GenderEnum;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'URL avatar',
  })
  avatarUrl?: string;

  @ApiProperty({
    enum: UserStatusEnum,
    example: UserStatusEnum.ACTIVE,
    description: 'Trạng thái tài khoản',
  })
  status: UserStatusEnum;

  @ApiPropertyOptional({
    example: '079123456789',
    description: 'Số CCCD',
  })
  CCCD?: string;

  // ====== Address (thường từ user) ======
  @ApiPropertyOptional({ example: 'Hồ Chí Minh', description: 'Tỉnh/Thành phố' })
  province?: string;

  @ApiPropertyOptional({ example: 'Quận 1', description: 'Quận/Huyện' })
  district?: string;

  @ApiPropertyOptional({ example: 'Phường Bến Nghé', description: 'Phường/Xã' })
  ward?: string;

  @ApiPropertyOptional({ example: '123 Đường Nguyễn Huệ', description: 'Địa chỉ chi tiết' })
  address?: string;

  // ====== Doctor professional info (từ entity Doctor) ======
  @ApiPropertyOptional({
    example: 2015,
    description: 'Năm bắt đầu hành nghề',
  })
  practiceStartYear?: number;

  @ApiProperty({
    example: 'VN-ABC-123456',
    description: 'Số chứng chỉ hành nghề (license number)',
  })
  licenseNumber: string;

  @ApiPropertyOptional({
    description: 'Danh sách URL ảnh chứng chỉ hành nghề',
    example: [{ url: 'https://example.com/license-1.jpg', expiry: '2028-12-31' }],
    type: 'array',
  })
  licenseImageUrls?: { url: string; expiry?: string }[];

  @ApiPropertyOptional({
    enum: DoctorTitle,
    example: DoctorTitle.SPECIALIST_DOCTOR_2,
    description: 'Học hàm/học vị'
  })
  title?: DoctorTitle;

  @ApiPropertyOptional({ example: 'Trưởng khoa', description: 'Chức vụ' })
  position?: string;

  @ApiPropertyOptional({
    enum: Specialty,
    example: Specialty.PULMONOLOGY,
    description: 'Chuyên khoa',
  })
  specialty?: Specialty;

  @ApiPropertyOptional({
    example: 8,
    description: 'Số năm kinh nghiệm',
  })
  yearsOfExperience?: number;

  @ApiPropertyOptional({
    example: 'd7c1cf97-6734-43ae-9a62-0f97b48f5888',
    description: 'ID bệnh viện chính đang công tác',
    nullable: true,
  })
  primaryHospitalId?: string | null;

  @ApiPropertyOptional({
    example: 'Chuyên sâu nội hô hấp, COPD, hen phế quản...',
    description: 'Mô tả trình độ chuyên môn',
  })
  expertiseDescription?: string;

  @ApiPropertyOptional({ example: 'Giới thiệu bác sĩ...', description: 'Bio/giới thiệu' })
  bio?: string;

  @ApiPropertyOptional({ example: '2016-2020 ...', description: 'Kinh nghiệm làm việc' })
  workExperience?: string;

  @ApiPropertyOptional({ example: 'ĐH Y Dược TP.HCM...', description: 'Học vấn' })
  education?: string;

  @ApiPropertyOptional({
    description: 'Chứng chỉ khác',
    example: [{ name: 'ACLS', issuer: 'AHA', year: 2022 }],
    type: 'array',
  })
  certifications?: { name: string; issuer: string; year: number }[];

  @ApiPropertyOptional({
    example: 'Giải thưởng/đề tài nghiên cứu...',
    description: 'Giải thưởng/Công trình nghiên cứu',
  })
  awardsResearch?: string;

  @ApiPropertyOptional({
    description: 'Đơn vị đào tạo (file/url + tên)',
    example: [{ url: 'https://example.com/training.pdf', name: 'ĐH Y Dược' }],
    type: 'array',
  })
  trainingUnits?: { url: string; name: string }[];

  @ApiProperty({
    example: '4.75',
    description: 'Điểm đánh giá trung bình (string do decimal)',
  })
  averageRating: string;

  @ApiProperty({ example: 120, description: 'Tổng số lượt đánh giá' })
  totalReviews: number;

  @ApiPropertyOptional({
    example: '2025-12-31T00:00:00.000Z',
    description: 'Thời điểm được duyệt xác thực',
  })
  verifiedAt?: Date;

  @ApiPropertyOptional({
    example: '300000',
    description: 'Phí khám mặc định (VND) - dùng khi schedule không set phí riêng',
    nullable: true,
  })
  defaultConsultationFee?: string | null;
  
  // ====== timestamps ======
  @ApiProperty({ example: '2023-01-01T00:00:00.000Z', description: 'Thời gian tạo tài khoản bác sĩ' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z', description: 'Thời gian cập nhật cuối' })
  updatedAt: Date;
}

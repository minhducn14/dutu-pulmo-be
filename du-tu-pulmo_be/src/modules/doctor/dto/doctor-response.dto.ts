import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpecialtyEnum } from 'src/modules/common/enums/specialty.enum';
import { DoctorTitle } from 'src/modules/common/enums/doctor-title.enum';
import { UserStatusEnum } from '../../common/enums/user-status.enum';
import { GenderEnum } from '../../common/enums/gender.enum';

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
  @ApiPropertyOptional({
    example: 'Hồ Chí Minh',
    description: 'Tỉnh/Thành phố',
  })
  province?: string;

  @ApiPropertyOptional({ example: 'Quận 1', description: 'Quận/Huyện' })
  ward?: string;

  @ApiPropertyOptional({
    example: '123 Đường Nguyễn Huệ',
    description: 'Địa chỉ chi tiết',
  })
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
    example: [
      { url: 'https://example.com/license-1.jpg', expiry: '2028-12-31' },
    ],
    type: 'array',
  })
  licenseImageUrls?: { url: string; expiry?: string }[];

  @ApiPropertyOptional({
    enum: DoctorTitle,
    example: DoctorTitle.SPECIALIST_DOCTOR_2,
    description: 'Học hàm/học vị',
  })
  title?: DoctorTitle;

  @ApiPropertyOptional({ example: 'Trưởng khoa', description: 'Chức vụ' })
  position?: string;

  @ApiPropertyOptional({
    enum: SpecialtyEnum,
    example: SpecialtyEnum.PULMONOLOGY,
    description: 'Chuyên khoa',
  })
  specialty?: SpecialtyEnum;

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
    description: 'Thông tin bệnh viện chính',
    nullable: true,
  })
  primaryHospital?: {
    id: string;
    name: string;
    hospitalCode: string;
    address: string;
    phone: string;
  } | null;

  @ApiPropertyOptional({
    example: 'Chuyên sâu nội hô hấp, COPD, hen phế quản...',
    description: 'Mô tả trình độ chuyên môn',
  })
  expertiseDescription?: string;

  @ApiPropertyOptional({
    example: 'Giới thiệu bác sĩ...',
    description: 'Bio/giới thiệu',
  })
  bio?: string;

  @ApiPropertyOptional({
    example: '2016-2020 ...',
    description: 'Kinh nghiệm làm việc',
  })
  workExperience?: string;

  @ApiPropertyOptional({
    example: 'ĐH Y Dược TP.HCM...',
    description: 'Học vấn',
  })
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
    description:
      'Phí khám mặc định (VND) - dùng khi schedule không set phí riêng',
    nullable: true,
  })
  defaultConsultationFee?: string | null;

  // ====== timestamps ======
  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Thời gian tạo tài khoản bác sĩ',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Thời gian cập nhật cuối',
  })
  updatedAt: Date;

  static fromEntity(doctor: {
    id: string;
    userId: string;
    user?: {
      fullName?: string;
      phone?: string;
      dateOfBirth?: Date;
      gender?: GenderEnum;
      avatarUrl?: string;
      status?: UserStatusEnum;
      CCCD?: string;
      province?: string;
      ward?: string;
      address?: string;
    };
    practiceStartYear?: number;
    licenseNumber: string;
    licenseImageUrls?: { url: string; expiry?: string }[];
    title?: DoctorTitle;
    position?: string;
    specialty?: SpecialtyEnum;
    yearsOfExperience?: number;
    primaryHospitalId?: string | null;
    primaryHospital?: {
      id: string;
      name: string;
      hospitalCode: string;
      address: string;
      phone: string;
    } | null;
    expertiseDescription?: string;
    bio?: string;
    workExperience?: string;
    education?: string;
    certifications?: { name: string; issuer: string; year: number }[];
    awardsResearch?: string;
    trainingUnits?: { url: string; name: string }[];
    averageRating: string;
    totalReviews: number;
    verifiedAt?: Date;
    defaultConsultationFee?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DoctorResponseDto {
    const dto = new DoctorResponseDto();
    dto.id = doctor.id;
    dto.userId = doctor.userId;
    dto.fullName = doctor.user?.fullName;
    dto.phone = doctor.user?.phone;
    dto.dateOfBirth = doctor.user?.dateOfBirth;
    dto.gender = doctor.user?.gender;
    dto.avatarUrl = doctor.user?.avatarUrl;
    dto.status = doctor.user?.status as UserStatusEnum;
    dto.CCCD = doctor.user?.CCCD;
    dto.province = doctor.user?.province;
    dto.ward = doctor.user?.ward;
    dto.address = doctor.user?.address;
    dto.practiceStartYear = doctor.practiceStartYear;
    dto.licenseNumber = doctor.licenseNumber;
    dto.licenseImageUrls = doctor.licenseImageUrls;
    dto.title = doctor.title;
    dto.position = doctor.position;
    dto.specialty = doctor.specialty;
    dto.yearsOfExperience = doctor.yearsOfExperience;
    dto.primaryHospitalId = doctor.primaryHospitalId ?? null;
    dto.primaryHospital = doctor.primaryHospital ?? null;
    dto.expertiseDescription = doctor.expertiseDescription;
    dto.bio = doctor.bio;
    dto.workExperience = doctor.workExperience;
    dto.education = doctor.education;
    dto.certifications = doctor.certifications;
    dto.awardsResearch = doctor.awardsResearch;
    dto.trainingUnits = doctor.trainingUnits;
    dto.averageRating = doctor.averageRating;
    dto.totalReviews = doctor.totalReviews;
    dto.verifiedAt = doctor.verifiedAt;
    dto.defaultConsultationFee = doctor.defaultConsultationFee;
    dto.createdAt = doctor.createdAt;
    dto.updatedAt = doctor.updatedAt;
    return dto;
  }

  static fromNullable(
    doctor:
      | Parameters<typeof DoctorResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): DoctorResponseDto | null {
    return doctor ? DoctorResponseDto.fromEntity(doctor) : null;
  }
}

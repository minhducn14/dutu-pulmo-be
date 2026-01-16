import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FacilityTypeEnum } from 'src/modules/common/enums/facility-type.enum';

export class HospitalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  hospitalCode: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({
    enum: FacilityTypeEnum,
    description: 'Loại cơ sở y tế',
  })
  facilityType: FacilityTypeEnum;

  @ApiProperty({ required: false, description: 'URL logo của bệnh viện' })
  logoUrl?: string;

  // ===== ĐỊA CHỈ =====
  @ApiProperty({ required: false, description: 'Mã tỉnh/thành phố' })
  provinceCode?: string;

  @ApiProperty({ required: false, description: 'Tỉnh/Thành phố' })
  province?: string;

  @ApiProperty({ required: false, description: 'Mã phường/xã' })
  wardCode?: string;

  @ApiProperty({ required: false, description: 'Phường/Xã' })
  ward?: string;

  @ApiProperty({ required: false, description: 'Địa chỉ chi tiết' })
  address?: string;

  // ===== TỌA ĐỘ =====
  @ApiProperty({ required: false })
  latitude?: number;

  @ApiProperty({ required: false })
  longitude?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Số lượng bác sĩ làm việc tại bệnh viện',
  })
  doctorCount?: number;
}

export class PaginatedHospitalResponseDto {
  @ApiProperty({ type: [HospitalResponseDto] })
  data: HospitalResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

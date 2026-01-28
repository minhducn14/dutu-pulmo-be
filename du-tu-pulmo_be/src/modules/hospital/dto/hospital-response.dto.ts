import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HospitalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  hospitalCode: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  ward: string;

  @ApiProperty()
  province: string;

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

  static fromEntity(hospital: {
    id: string;
    name: string;
    hospitalCode: string;
    phone: string;
    email: string;
    address: string;
    ward?: string | null;
    province?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    createdAt: Date;
    updatedAt: Date;
    doctorCount?: number;
  }): HospitalResponseDto {
    const dto = new HospitalResponseDto();
    dto.id = hospital.id;
    dto.name = hospital.name;
    dto.hospitalCode = hospital.hospitalCode;
    dto.phone = hospital.phone;
    dto.email = hospital.email;
    dto.address = hospital.address;
    dto.ward = hospital.ward ?? '';
    dto.province = hospital.province ?? '';
    dto.latitude = hospital.latitude ?? undefined;
    dto.longitude = hospital.longitude ?? undefined;
    dto.createdAt = hospital.createdAt;
    dto.updatedAt = hospital.updatedAt;
    dto.doctorCount = hospital.doctorCount;
    return dto;
  }

  static fromNullable(
    hospital:
      | Parameters<typeof HospitalResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): HospitalResponseDto | null {
    return hospital ? HospitalResponseDto.fromEntity(hospital) : null;
  }
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

import {
  Controller,
  Get,
  Param,
  HttpStatus,
  Query,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DoctorService } from './doctor.service';
import { FindDoctorsDto } from './dto/find-doctors.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { DoctorResponseDto } from './dto/doctor-response.dto';

/**
 * Public endpoints for patients to view doctor information
 * No authentication required
 */
@ApiTags('Public - Doctors')
@Controller('public/doctors')
export class PublicDoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bác sĩ công khai (có phân trang)' })
  @ApiResponse({ status: HttpStatus.OK, type: [DoctorResponseDto] })
  async findAll(
    @Query() dto: FindDoctorsDto,
  ): Promise<ResponseCommon<DoctorResponseDto[]>> {
    const response = await this.doctorService.findAllPaginated(dto);
    const doctors = response.data?.items ?? [];
    const data = doctors.map((doc) => this.toPublicResponseDto(doc));
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết bác sĩ công khai' })
  @ApiParam({ name: 'id', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bác sĩ',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<DoctorResponseDto>> {
    const response = await this.doctorService.findOne(id);
    const doc = response.data;
    if (!doc) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      this.toPublicResponseDto(doc),
    );
  }

  /**
   * Map Doctor entity to public DoctorResponseDto
   * Excludes sensitive information like CCCD
   */
  private toPublicResponseDto(doctor: any): DoctorResponseDto {
    const user = doctor.user;

    return {
      id: doctor.id,
      userId: doctor.userId,
      fullName: user?.fullName,
      phone: user?.phone,
      dateOfBirth: user?.dateOfBirth,
      gender: user?.gender,
      avatarUrl: user?.avatarUrl,
      status: user?.status,
      province: user?.province,
      ward: user?.ward,
      address: user?.address,
      practiceStartYear: doctor.practiceStartYear,
      licenseNumber: doctor.licenseNumber,
      licenseImageUrls: doctor.licenseImageUrls,
      title: doctor.title,
      position: doctor.position,
      specialty: doctor.specialty,
      yearsOfExperience: doctor.yearsOfExperience,
      primaryHospitalId: doctor.primaryHospitalId,
      expertiseDescription: doctor.expertiseDescription,
      bio: doctor.bio,
      workExperience: doctor.workExperience,
      education: doctor.education,
      certifications: doctor.certifications,
      awardsResearch: doctor.awardsResearch,
      trainingUnits: doctor.trainingUnits,
      averageRating: doctor.averageRating,
      totalReviews: doctor.totalReviews,
      defaultConsultationFee: doctor.defaultConsultationFee,
      verifiedAt: doctor.verifiedAt,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };
  }
}

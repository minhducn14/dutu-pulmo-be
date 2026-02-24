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
import { DoctorService } from '@/modules/doctor/services/doctor.service';
import { FindDoctorsDto } from '@/modules/doctor/dto/find-doctors.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';

@ApiTags('Public - Doctors')
@Controller('public/doctors')
export class PublicDoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bác sĩ công khai (có phân trang)' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedResponseDto })
  async findAll(
    @Query() dto: FindDoctorsDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<DoctorResponseDto>>> {
    const response = await this.doctorService.findAllPaginated(dto);
    const fallback = new PaginatedResponseDto<Doctor>(
      [],
      0,
      dto.page ?? 1,
      dto.limit ?? 10,
    );
    const paginated = response.data ?? fallback;
    const items = (paginated.items ?? []).map((doc) =>
      this.toPublicResponseDto(doc),
    );
    return new ResponseCommon(response.code, response.message, {
      items,
      meta: paginated.meta,
    });
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
  private toPublicResponseDto(doctor: Doctor): DoctorResponseDto {
    const dto = DoctorResponseDto.fromEntity(doctor);
    if (dto.userId) {
      // Ensure public response doesn't expose sensitive fields.
      dto.CCCD = undefined;
    }
    return dto;
  }
}

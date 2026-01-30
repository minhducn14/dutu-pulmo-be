import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PatientService } from '@/modules/patient/patient.service';
import {
  PatientQueryDto,
  UpdatePatientDto,
} from '@/modules/patient/dto/patient.dto';
import {
  PatientResponseDto,
  PaginatedPatientResponseDto,
  PatientProfileResponseDto,
} from '@/modules/patient/dto/patient-response.dto';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import {
  PaginatedAppointmentResponseDto,
  AppointmentResponseDto,
} from '@/modules/appointment/dto/appointment-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { Patient } from '@/modules/patient/entities/patient.entity';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // ==================== Mappers ====================

  private toPatientDto(patient: Patient): PatientResponseDto {
    return PatientResponseDto.fromEntity(patient);
  }

  // ============================================================================
  // CRUD ENDPOINTS
  // ============================================================================

  @Get()
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Lấy danh sách bệnh nhân (Admin/Doctor)',
    description:
      'Hỗ trợ phân trang, tìm kiếm theo tên/phone/mã bệnh nhân, lọc theo nhóm máu',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'bloodType', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách bệnh nhân',
    type: PaginatedPatientResponseDto,
  })
  async findAll(
    @Query() query: PatientQueryDto,
  ): Promise<ResponseCommon<PaginatedPatientResponseDto>> {
    const result = await this.patientService.findAll(query);
    const fallback = {
      items: [] as Patient[],
      meta: {
        currentPage: query.page || 1,
        itemsPerPage: query.limit || 10,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    const data = (result.data ?? fallback) as {
      items: Patient[];
      meta: PaginatedPatientResponseDto['meta'];
    };
    const items = (data.items || []).map((p) => this.toPatientDto(p));

    return new ResponseCommon(result.code, result.message, {
      items,
      meta: data.meta,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin bệnh nhân của user hiện tại' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin bệnh nhân',
    type: PatientResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không phải bệnh nhân',
  })
  async getMe(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientResponseDto>> {
    if (!user.patientId) {
      throw new ForbiddenException('Bạn không phải là bệnh nhân');
    }
    const result = await this.patientService.findOne(user.patientId);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toPatientDto(result.data as Patient),
    );
  }

  @Get('me/profile')
  @ApiOperation({ summary: 'Lấy hồ sơ bệnh nhân với thống kê tổng hợp' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hồ sơ bệnh nhân với summary',
    type: PatientProfileResponseDto,
  })
  async getMyProfile(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientProfileResponseDto>> {
    if (!user.patientId) {
      throw new ForbiddenException('Bạn không phải là bệnh nhân');
    }
    const result = await this.patientService.getProfile(user.patientId);

    const data = result.data as {
      patient: Patient;
      summary: {
        totalMedicalRecords: number;
        totalVitalSigns: number;
        totalPrescriptions: number;
        latestVitalSign?: null;
      };
    };
    const patientDto = this.toPatientDto(data.patient);
    const summary = {
      ...data.summary,
      latestVitalSign: data.summary.latestVitalSign,
    };

    return new ResponseCommon(result.code, result.message, {
      patient: patientDto,
      summary,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy thông tin bệnh nhân theo ID (Admin/Doctor/Chính mình)',
  })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin bệnh nhân',
    type: PatientResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Bệnh nhân không tồn tại',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientResponseDto>> {
    const isAdminOrDoctor =
      user.roles?.includes(RoleEnum.ADMIN) ||
      user.roles?.includes(RoleEnum.DOCTOR);
    const isOwner = user.patientId === id;

    if (!isAdminOrDoctor && !isOwner) {
      throw new ForbiddenException(
        'Bạn không có quyền xem thông tin bệnh nhân này',
      );
    }

    const result = await this.patientService.findOne(id);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toPatientDto(result.data as Patient),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin bệnh nhân (Admin/Chính mình)' })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật thành công',
    type: PatientResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền cập nhật',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientResponseDto>> {
    const isAdmin = user.roles?.includes(RoleEnum.ADMIN);
    const isOwner = user.patientId === id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Bạn chỉ có thể cập nhật thông tin của mình',
      );
    }

    const result = await this.patientService.update(id, dto);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toPatientDto(result.data as Patient),
    );
  }

  @Get(':id/profile')
  @ApiOperation({
    summary: 'Lấy hồ sơ tổng hợp bệnh nhân (thông tin + thống kê)',
  })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hồ sơ bệnh nhân với summary',
    type: PatientProfileResponseDto,
  })
  async getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientProfileResponseDto>> {
    this.checkPatientAccess(id, user);
    const result = await this.patientService.getProfile(id);

    const data = result.data as {
      patient: Patient;
      summary: {
        totalMedicalRecords: number;
        totalVitalSigns: number;
        totalPrescriptions: number;
        latestVitalSign?: null;
      };
    };
    const patientDto = this.toPatientDto(data.patient);
    const summary = {
      ...data.summary,
      latestVitalSign: data.summary.latestVitalSign,
    };

    return new ResponseCommon(result.code, result.message, {
      patient: patientDto,
      summary,
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private checkPatientAccess(patientId: string, user: JwtUser): void {
    const isAdminOrDoctor =
      user.roles?.includes(RoleEnum.ADMIN) ||
      user.roles?.includes(RoleEnum.DOCTOR);
    const isOwner = user.patientId === patientId;

    if (!isAdminOrDoctor && !isOwner) {
      throw new ForbiddenException(
        'Bạn không có quyền xem thông tin bệnh nhân này',
      );
    }
  }
}

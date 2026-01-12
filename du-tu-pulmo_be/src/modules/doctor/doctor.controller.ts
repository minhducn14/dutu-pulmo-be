import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  Query,
  ParseUUIDPipe,
  ForbiddenException,
  NotFoundException,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FindDoctorsDto } from './dto/find-doctors.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { RoleEnum } from '../common/enums/role.enum';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DoctorResponseDto } from './dto/doctor-response.dto';
import {
  fileTypeConfigs,
  FileDefaults,
} from 'src/common/config/file-type.config';
import { SpecialtyEnum } from '../common/enums/specialty.enum';
import { DoctorTitle } from '../common/enums/doctor-title.enum';

@ApiTags('Doctors')
@Controller('doctors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorController {
  constructor(
    private readonly doctorService: DoctorService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bác sĩ (có phân trang)' })
  @ApiResponse({ status: HttpStatus.OK, type: [DoctorResponseDto] })
  async findAll(
    @Query() dto: FindDoctorsDto,
  ): Promise<ResponseCommon<DoctorResponseDto[]>> {
    const response = await this.doctorService.findAllPaginated(dto);
    const doctors = response.data?.items ?? [];
    const data = doctors.map((doc) => this.toResponseDto(doc));
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết bác sĩ' })
  @ApiParam({ name: 'id', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bác sĩ',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<DoctorResponseDto>> {
    if (!user.roles?.includes(RoleEnum.ADMIN) && user.doctorId !== id) {
      throw new ForbiddenException(
        'Bạn chỉ có thể cập nhật thông tin của mình',
      );
    }
    const response = await this.doctorService.findOne(id);
    const doc = response.data;
    if (!doc) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      this.toResponseDto(doc),
    );
  }

  @Post()
  @Roles(RoleEnum.ADMIN)
  @UseInterceptors(
    FilesInterceptor('licenseImages', FileDefaults.MAX_LICENSE_IMAGES, {
      limits: { fileSize: fileTypeConfigs.image.maxSize },
      fileFilter: (req, file, callback) => {
        if (!fileTypeConfigs.image.allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Chỉ chấp nhận file ảnh (jpg, jpeg, png, webp)',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({
    summary: 'Tạo hồ sơ bác sĩ mới với upload ảnh giấy phép (Admin)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'doctor@email.com' },
        password: { type: 'string', example: 'SecurePass123' },
        fullName: { type: 'string', example: 'BS. Nguyễn Văn A' },
        phone: { type: 'string', example: '0912345678' },
        licenseImages: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Ảnh giấy phép hành nghề (bắt buộc, tối đa 5 ảnh)',
        },
        licenseNumber: { type: 'string', example: 'GP-12345' },
        practiceStartYear: { type: 'number', example: 2010 },
        title: {
          type: 'string',
          example: DoctorTitle.PHD_DOCTOR,
          enum: Object.values(DoctorTitle),
        },
        position: { type: 'string', example: 'Trưởng khoa' },
        bio: { type: 'string' },
        specialty: {
          type: 'string',
          example: SpecialtyEnum.PULMONOLOGY,
          enum: Object.values(SpecialtyEnum ),
        },
        defaultConsultationFee: { type: 'number', example: 100000 },
      },
      required: [
        'email',
        'password',
        'fullName',
        'licenseNumber',
        'licenseImages',
      ],
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: DoctorResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email hoặc số giấy phép đã tồn tại',
  })
  async create(
    @Body() dto: CreateDoctorDto,
    @UploadedFiles() licenseImages: Express.Multer.File[],
  ): Promise<ResponseCommon<DoctorResponseDto>> {
    // Validate license images are provided
    if (!licenseImages || licenseImages.length === 0) {
      throw new BadRequestException(
        'Vui lòng tải lên ít nhất 1 ảnh giấy phép hành nghề',
      );
    }

    // Upload license images to Cloudinary
    const uploadResults = await this.cloudinaryService.uploadImages(
      licenseImages,
      'doctor-licenses',
    );

    // Map upload results to licenseImageUrls format
    dto.licenseImageUrls = uploadResults.map((result) => ({
      url: result.url,
      expiry: undefined,
    }));

    const response = await this.doctorService.create(dto);
    const doc = response.data;
    return new ResponseCommon(
      response.code,
      response.message,
      this.toResponseDto(doc),
    );
  }

  @Patch(':id')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Cập nhật hồ sơ bác sĩ (Admin hoặc chính mình)' })
  @ApiParam({ name: 'id', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bác sĩ',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<DoctorResponseDto>> {
    if (!user.roles?.includes(RoleEnum.ADMIN) && user.doctorId !== id) {
      throw new ForbiddenException(
        'Bạn chỉ có thể cập nhật thông tin của mình',
      );
    }
    const response = await this.doctorService.update(id, dto);
    const doc = response.data;
    if (!doc) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      this.toResponseDto(doc),
    );
  }

  @Delete(':id')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Xóa bác sĩ (Admin - soft delete)' })
  @ApiParam({ name: 'id', description: 'Doctor ID to delete' })
  @ApiResponse({ status: HttpStatus.OK })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body('reason') reason?: string,
  ): Promise<ResponseCommon<null>> {
    return this.doctorService.remove(id, user.accountId, reason);
  }

  @Get('admin/deleted')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Xem danh sách bác sĩ đã xóa (Admin)' })
  @ApiResponse({ status: HttpStatus.OK })
  async findDeleted(): Promise<ResponseCommon<DoctorResponseDto[]>> {
    const response = await this.doctorService.findDeleted();
    const doctors = response.data ?? [];
    const data = doctors.map((doc) => ({
      ...this.toResponseDto(doc),
      deletedAt: (doc as any).deletedAt,
    }));
    return new ResponseCommon(response.code, response.message, data);
  }

  @Post(':id/restore')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Khôi phục bác sĩ đã xóa (Admin)' })
  @ApiParam({ name: 'id', description: 'Doctor ID to restore' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorResponseDto })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<DoctorResponseDto | null>> {
    const response = await this.doctorService.restore(id);
    const doc = response.data;
    if (!doc) {
      throw new NotFoundException('Không tìm thấy bác sĩ');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      this.toResponseDto(doc),
    );
  }

  /**
   * Map Doctor entity to DoctorResponseDto
   */
  private toResponseDto(doctor: any): DoctorResponseDto {
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
      CCCD: user?.CCCD,
      province: user?.province,
      district: user?.district,
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
      verifiedAt: doctor.verifiedAt,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { ScreeningService } from '@/modules/screening/screening.service';
import { CloudinaryService } from '@/modules/cloudinary/cloudinary.service';
import { FileValidationService } from '@/modules/screening/file-validation.service';
import { ScreeningStatusEnum } from '@/modules/common/enums/screening-status.enum';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { TriggerAiAnalysisDto } from '@/modules/screening/dto/trigger-ai-analysis.dto';
import { CreateScreeningRequestDto } from '@/modules/screening/dto/create-screening-request.dto';
import { UploadAnalyzeResponseDto } from '@/modules/screening/dto/upload-analyze-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { PatientService } from '@/modules/patient/patient.service';
import { ScreeningRequestResponseDto } from '@/modules/screening/dto/screening-request-response.dto';
import { MedicalImageResponseDto } from '@/modules/screening/dto/medical-image-response.dto';
import { AiAnalysisResponseDto } from '@/modules/screening/dto/ai-analysis-entity-response.dto';
import { SCREENING_ERRORS, DOCTOR_ERRORS, PATIENT_ERRORS, USER_ERRORS } from '@/common/constants/error-messages.constant';

@ApiTags('Screening')
@Controller('screenings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ScreeningController {
  constructor(
    private readonly screeningService: ScreeningService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly fileValidationService: FileValidationService,
    private readonly patientService: PatientService,
  ) {}

  @Get()
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu sàng lọc (Admin/Doctor)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách yêu cầu sàng lọc',
    type: [ScreeningRequestResponseDto],
  })
  async findAll(): Promise<ResponseCommon<ScreeningRequestResponseDto[]>> {
    const screenings = await this.screeningService.findAll();
    const data = (screenings ?? []).map((screening) =>
      ScreeningRequestResponseDto.fromEntity(screening),
    );
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }

  @Get('uploaded')
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'Lấy danh sách screening do bác sĩ tạo/upload' })
  async findUploadedByMe(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ScreeningRequestResponseDto[]>> {
    if (!user.doctorId) {
      throw new ForbiddenException(DOCTOR_ERRORS.MISSING_DOCTOR_INFO);
    }
    const screenings = await this.screeningService.findByUploaderDoctor(
      user.doctorId,
    );
    const data = (screenings ?? []).map((screening) =>
      ScreeningRequestResponseDto.fromEntity(screening),
    );
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }

  @Get('assigned')
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'Lấy danh sách sàng lọc được giao cho bác sĩ' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách sàng lọc được giao',
    type: [ScreeningRequestResponseDto],
  })
  async findAssignedScreenings(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ScreeningRequestResponseDto[]>> {
    if (!user.doctorId) {
      throw new ForbiddenException(DOCTOR_ERRORS.MISSING_DOCTOR_INFO);
    }
    const screenings = await this.screeningService.findByDoctor(user.doctorId);
    const data = (screenings ?? []).map((screening) =>
      ScreeningRequestResponseDto.fromEntity(screening),
    );
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết yêu cầu sàng lọc' })
  @ApiParam({ name: 'id', description: 'Screening Request ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chi tiết yêu cầu sàng lọc',
    type: ScreeningRequestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy yêu cầu',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ScreeningRequestResponseDto>> {
    const screening = await this.screeningService.findById(id);

    if (!user.roles?.includes('ADMIN')) {
      if (user.roles?.includes('DOCTOR')) {
        const canAccess =
          screening.uploadedByDoctorId === user.doctorId ||
          screening.assignedDoctorId === user.doctorId;

        if (!canAccess) {
          throw new ForbiddenException(
            SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
          );
        }
      }

      // nếu vẫn cho PATIENT xem:
      if (user.roles?.includes('PATIENT')) {
        if (screening.patientId !== user.patientId) {
          throw new ForbiddenException(
            SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
          );
        }
      }
    }

    return new ResponseCommon(
      HttpStatus.OK,
      'SUCCESS',
      ScreeningRequestResponseDto.fromEntity(screening),
    );
  }

  @Put(':id/status')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Cập nhật trạng thái yêu cầu sàng lọc' })
  @ApiParam({ name: 'id', description: 'Screening Request ID (UUID)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: Object.values(ScreeningStatusEnum),
          description: 'Trạng thái mới',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật trạng thái thành công',
    type: ScreeningRequestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ScreeningStatusEnum,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ScreeningRequestResponseDto>> {
    if (user.roles?.includes('DOCTOR') && !user.roles?.includes('ADMIN')) {
      const screening = await this.screeningService.findById(id);
      const canUpdate =
        screening.uploadedByDoctorId === user.doctorId ||
        screening.assignedDoctorId === user.doctorId;

      if (!canUpdate) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
    }

    const updated = await this.screeningService.updateStatus(id, status);
    return new ResponseCommon(
      HttpStatus.OK,
      'SUCCESS',
      ScreeningRequestResponseDto.fromEntity(updated),
    );
  }

  @Post()
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Bác sĩ tạo yêu cầu sàng lọc (doctor upload)' })
  @ApiBody({ type: CreateScreeningRequestDto })
  async create(
    @Body() data: CreateScreeningRequestDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ScreeningRequestResponseDto>> {
    if (!user.doctorId && !user.roles?.includes('ADMIN')) {
      throw new ForbiddenException(DOCTOR_ERRORS.MISSING_DOCTOR_INFO);
    }
    if (!data.patientId) {
      throw new BadRequestException(PATIENT_ERRORS.MISSING_PATIENT_ID);
    }

    const created = await this.screeningService.create({
      ...data,
      patientId: data.patientId,
      uploadedByDoctorId: user.doctorId,
    });
    return new ResponseCommon(
      HttpStatus.CREATED,
      'SUCCESS',
      ScreeningRequestResponseDto.fromEntity(created),
    );
  }

  @Post(':screeningId/images/upload')
  @Roles('DOCTOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload ảnh X-quang cho yêu cầu sàng lọc',
    description:
      'Upload ảnh và lưu metadata vào database. Ảnh sẽ được upload lên Cloudinary.',
  })
  @ApiParam({ name: 'screeningId', description: 'Screening Request ID (UUID)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh X-quang (DICOM, JPEG, PNG)',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Upload ảnh thành công',
    type: MedicalImageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'File không hợp lệ hoặc vượt quá giới hạn kích thước',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy yêu cầu sàng lọc',
  })
  async uploadImage(
    @Param('screeningId', ParseUUIDPipe) screeningId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalImageResponseDto>> {
    if (!file) {
      throw new BadRequestException(USER_ERRORS.NO_FILE_UPLOADED);
    }

    const screening = await this.screeningService.findById(screeningId);

    if (!user.roles?.includes('ADMIN')) {
      const canUpload =
        screening.uploadedByDoctorId === user.doctorId ||
        screening.assignedDoctorId === user.doctorId;

      if (!canUpload) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
    }

    const validation = this.fileValidationService.validateOrThrow(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    const uploadResult = await this.cloudinaryService.uploadMedicalImage(
      file,
      screeningId,
      'original',
    );

    const thumbnailUrl = this.cloudinaryService.getThumbnailUrl(
      uploadResult.publicId,
      200,
      200,
    );

    const medicalImage = await this.screeningService.addImage(screeningId, {
      fileUrl: uploadResult.url,
      thumbnailUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: validation.mimeType,
      width: uploadResult.width,
      height: uploadResult.height,
    });

    await this.screeningService.updateStatus(
      screeningId,
      ScreeningStatusEnum.UPLOADED,
    );

    return new ResponseCommon(
      HttpStatus.CREATED,
      'SUCCESS',
      MedicalImageResponseDto.fromEntity(medicalImage),
    );
  }

  @Post(':screeningId/images/:imageId/analyze')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({
    summary: 'Kích hoạt phân tích AI cho ảnh X-quang',
    description:
      'Gửi ảnh đến dịch vụ AI để phân tích và nhận kết quả chẩn đoán',
  })
  @ApiParam({ name: 'screeningId', description: 'Screening Request ID (UUID)' })
  @ApiParam({ name: 'imageId', description: 'Medical Image ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Phân tích AI hoàn tất',
    type: AiAnalysisResponseDto,
  })
  @ApiBody({ type: TriggerAiAnalysisDto })
  async triggerAiAnalysis(
    @Param('screeningId', ParseUUIDPipe) screeningId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: TriggerAiAnalysisDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AiAnalysisResponseDto>> {
    const screening = await this.screeningService.findById(screeningId);

    if (!user.roles?.includes('ADMIN')) {
      const canAnalyze =
        screening.uploadedByDoctorId === user.doctorId ||
        screening.assignedDoctorId === user.doctorId;
      if (!canAnalyze) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
    }

    const analysis = await this.screeningService.triggerAiAnalysis(
      screeningId,
      imageId,
      dto.modelVersion,
    );
    return new ResponseCommon(
      HttpStatus.CREATED,
      'SUCCESS',
      AiAnalysisResponseDto.fromEntity(analysis),
    );
  }

  @Get(':screeningId/images')
  @ApiOperation({ summary: 'Lấy danh sách ảnh của yêu cầu sàng lọc' })
  @ApiParam({ name: 'screeningId', description: 'Screening Request ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách ảnh',
    type: [MedicalImageResponseDto],
  })
  async getImages(
    @Param('screeningId', ParseUUIDPipe) screeningId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalImageResponseDto[]>> {
    const screening = await this.screeningService.findById(screeningId);

    if (!user.roles?.includes('ADMIN')) {
      if (
        user.roles?.includes('PATIENT') &&
        screening.patientId !== user.patientId
      ) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
      if (
        user.roles?.includes('DOCTOR') &&
        screening.assignedDoctorId !== user.doctorId
      ) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
    }

    const images = screening.images || [];
    const data = images.map((image) =>
      MedicalImageResponseDto.fromEntity(image),
    );
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }

  @Get(':screeningId/analyses')
  @ApiOperation({
    summary: 'Lấy danh sách kết quả phân tích AI cho yêu cầu sàng lọc',
  })
  @ApiParam({ name: 'screeningId', description: 'Screening Request ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách kết quả phân tích AI',
    type: [AiAnalysisResponseDto],
  })
  async getAiAnalyses(
    @Param('screeningId', ParseUUIDPipe) screeningId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AiAnalysisResponseDto[]>> {
    const screening = await this.screeningService.findById(screeningId);

    if (!user.roles?.includes('ADMIN')) {
      if (
        user.roles?.includes('PATIENT') &&
        screening.patientId !== user.patientId
      ) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
      if (
        user.roles?.includes('DOCTOR') &&
        screening.assignedDoctorId !== user.doctorId
      ) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
    }

    const analyses =
      await this.screeningService.findAiAnalysesByScreening(screeningId);
    const data = (analyses ?? []).map((analysis) =>
      AiAnalysisResponseDto.fromEntity(analysis),
    );
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }

  @Get('analyses/:analysisId')
  @ApiOperation({ summary: 'Lấy chi tiết kết quả phân tích AI' })
  @ApiParam({ name: 'analysisId', description: 'AI Analysis ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chi tiết kết quả phân tích AI',
    type: AiAnalysisResponseDto,
  })
  async getAiAnalysisById(
    @Param('analysisId', ParseUUIDPipe) analysisId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AiAnalysisResponseDto>> {
    const analysis = await this.screeningService.findAiAnalysisById(analysisId);
    const screening = await this.screeningService.findById(
      analysis.screeningId,
    );

    if (!user.roles?.includes('ADMIN')) {
      if (
        user.roles?.includes('PATIENT') &&
        screening.patientId !== user.patientId
      ) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
      if (
        user.roles?.includes('DOCTOR') &&
        screening.assignedDoctorId !== user.doctorId
      ) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
    }

    return new ResponseCommon(
      HttpStatus.OK,
      'SUCCESS',
      AiAnalysisResponseDto.fromEntity(analysis),
    );
  }

  @Post('workflow/xray-analyze')
  @Roles('DOCTOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload X-ray và chạy AI ngay (1 API cho FE upload box)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        screeningId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description:
            'Chỉ truyền khi muốn upload thêm ảnh cho screening đã tồn tại. Lần đầu KHÔNG cần.',
        },
        medicalRecordId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description:
            'Chỉ truyền khi muốn upload thêm ảnh cho screening đã tồn tại. Lần đầu KHÔNG cần.',
        },
        patientId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'Bắt buộc nếu tạo mới (không có screeningId)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh X-ray (PNG/JPG/DICOM...)',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: UploadAnalyzeResponseDto,
  })
  async uploadAndAnalyze(
    @UploadedFile() file: Express.Multer.File,
    @Body('screeningId') screeningId: string | undefined,
    @Body('patientId') patientId: string | undefined,
    @Body('medicalRecordId') medicalRecordId: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<UploadAnalyzeResponseDto>> {
    if (!user.doctorId && !user.roles?.includes('ADMIN')) {
      throw new ForbiddenException(DOCTOR_ERRORS.MISSING_DOCTOR_INFO);
    }

    if (!file) throw new BadRequestException('Không có file được upload');

    const patientResponse = patientId
      ? await this.patientService.findOne(patientId)
      : undefined;
    const patient = patientResponse?.data;

    if (!patient) {
      throw new NotFoundException(PATIENT_ERRORS.PATIENT_NOT_FOUND);
    }

    const screening = screeningId
      ? await this.screeningService.findById(screeningId)
      : await this.screeningService.create({
          patientId: patientId,
          uploadedByDoctorId: user.doctorId,
          medicalRecordId: medicalRecordId,
        });


    if (!screeningId && !patientId) {
      throw new BadRequestException(
        PATIENT_ERRORS.MISSING_PATIENT_ID,
      );
    }

    if (!user.roles?.includes('ADMIN')) {
      const canOperate =
        screening.uploadedByDoctorId === user.doctorId ||
        screening.assignedDoctorId === user.doctorId;
      if (!canOperate) {
        throw new ForbiddenException(
          SCREENING_ERRORS.ACCESS_DENIED_SCREENING,
        );
      }
    }

    // 2) Validate file
    const validation = this.fileValidationService.validateOrThrow(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // 3) Upload Cloudinary
    const uploadResult = await this.cloudinaryService.uploadMedicalImage(
      file,
      screening.id,
      'original',
    );

    const thumbnailUrl = this.cloudinaryService.getThumbnailUrl(
      uploadResult.publicId,
      200,
      200,
    );

    // 4) Save image metadata
    const image = await this.screeningService.addImage(screening.id, {
      fileUrl: uploadResult.url,
      thumbnailUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: validation.mimeType,
      width: uploadResult.width,
      height: uploadResult.height,
    });

    // 5) Mark UPLOADED (tránh lỗi UPLOADED -> UPLOADED vì status default của entity là UPLOADED)
    if (screening.status !== ScreeningStatusEnum.UPLOADED) {
      await this.screeningService.updateStatus(
        screening.id,
        ScreeningStatusEnum.UPLOADED,
      );
    }

    // 6) Trigger AI
    const analysis = await this.screeningService.triggerAiAnalysis(
      screening.id,
      image.id,
    );

    // 7) Return for FE render
    const responseData: UploadAnalyzeResponseDto = {
      screening: ScreeningRequestResponseDto.fromEntity(
        await this.screeningService.findById(screening.id),
      ),
      image: MedicalImageResponseDto.fromEntity(image),
      analysis: AiAnalysisResponseDto.fromEntity(analysis),
    };

    return new ResponseCommon(
      HttpStatus.CREATED,
      'Upload and analysis completed successfully',
      responseData,
    );
  }
}

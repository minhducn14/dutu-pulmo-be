import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  Query,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TimeSlotService } from '@/modules/doctor/services/time-slot.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { DoctorOwnershipGuard } from '@/modules/core/auth/guards/doctor-ownership.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import {
  CreateTimeSlotDto,
  BulkCreateTimeSlotsDto,
  UpdateTimeSlotDto,
  ToggleSlotAvailabilityDto,
  BulkToggleSlotsDto,
  DisableSlotsForDayDto,
} from '@/modules/doctor/dto/time-slot.dto';
import { TimeSlotResponseDto } from '@/modules/doctor/dto/schedule-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Time Slots')
@ApiBearerAuth('JWT-auth')
@Controller('doctors/:doctorId/time-slots')
export class TimeSlotController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả time slots của bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách time slots',
    type: [TimeSlotResponseDto],
  })
  async findByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ): Promise<ResponseCommon<TimeSlotResponseDto[]>> {
    const result = await this.timeSlotService.findByDoctorId(doctorId);
    const data = (result.data ?? []).map((slot) =>
      TimeSlotResponseDto.fromEntity(slot),
    );
    return new ResponseCommon(result.code, result.message, data);
  }

  @Get('available')
  @ApiOperation({ summary: 'Lấy các time slots còn trống theo ngày' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({
    name: 'date',
    description: 'Ngày cần tìm (YYYY-MM-DD)',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách time slots còn trống',
    type: [TimeSlotResponseDto],
  })
  async findAvailable(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') dateStr: string,
  ): Promise<ResponseCommon<TimeSlotResponseDto[]>> {
    if (!dateStr) {
      throw new BadRequestException('Ngày không được để trống');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        'Ngày không hợp lệ, sử dụng format YYYY-MM-DD',
      );
    }
    const result = await this.timeSlotService.findAvailableSlotsByDate(
      doctorId,
      date,
    );
    const data = (result.data ?? []).map((slot) =>
      TimeSlotResponseDto.fromEntity(slot),
    );
    return new ResponseCommon(result.code, result.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một time slot' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Time Slot ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chi tiết time slot',
    type: TimeSlotResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy time slot',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<TimeSlotResponseDto>> {
    const result = await this.timeSlotService.findById(id);
    return new ResponseCommon(
      result.code,
      result.message,
      TimeSlotResponseDto.fromEntity(result.data!),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tạo time slot mới' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo time slot thành công',
    type: TimeSlotResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hoặc không phải lịch của mình',
  })
  async create(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateTimeSlotDto,
  ): Promise<ResponseCommon<TimeSlotResponseDto>> {
    const result = await this.timeSlotService.create(doctorId, dto);
    return new ResponseCommon(
      result.code,
      result.message,
      TimeSlotResponseDto.fromEntity(result.data!),
    );
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tạo nhiều time slots cùng lúc (tối đa 100)' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo time slots thành công',
    type: [TimeSlotResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vượt quá giới hạn hoặc dữ liệu không hợp lệ',
  })
  async createMany(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: BulkCreateTimeSlotsDto,
  ): Promise<ResponseCommon<TimeSlotResponseDto[]>> {
    const result = await this.timeSlotService.createMany(doctorId, dto.slots);
    const data = (result.data ?? []).map((slot) =>
      TimeSlotResponseDto.fromEntity(slot),
    );
    return new ResponseCommon(result.code, result.message, data);
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Bật/tắt trạng thái có thể đặt của time slot' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Time Slot ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thay đổi trạng thái thành công',
    type: TimeSlotResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể tắt slot đã có booking',
  })
  async toggleAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleSlotAvailabilityDto,
  ): Promise<ResponseCommon<TimeSlotResponseDto>> {
    const result = await this.timeSlotService.toggleSlotAvailability(
      id,
      dto.isAvailable,
    );
    return new ResponseCommon(
      result.code,
      result.message,
      TimeSlotResponseDto.fromEntity(result.data!),
    );
  }

  @Post('bulk-toggle')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Bật/tắt nhiều time slots cùng lúc (tối đa 100)' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Kết quả toggle',
  })
  bulkToggle(@Body() dto: BulkToggleSlotsDto) {
    return this.timeSlotService.bulkToggleSlots(dto.slotIds, dto.isAvailable);
  }

  @Post('disable-day')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tắt tất cả time slots của bác sĩ trong một ngày' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Kết quả tắt slots',
  })
  async disableDay(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: DisableSlotsForDayDto,
  ) {
    return this.timeSlotService.disableSlotsForDay(doctorId, dto.date);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật time slot' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Time Slot ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật thành công',
    type: TimeSlotResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hoặc không phải lịch của mình',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeSlotDto,
  ): Promise<ResponseCommon<TimeSlotResponseDto>> {
    const result = await this.timeSlotService.update(id, dto);
    return new ResponseCommon(
      result.code,
      result.message,
      TimeSlotResponseDto.fromEntity(result.data!),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xóa time slot' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Time Slot ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xóa thành công',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Không thể xóa slot đã có booking',
  })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeSlotService.delete(id);
  }
}

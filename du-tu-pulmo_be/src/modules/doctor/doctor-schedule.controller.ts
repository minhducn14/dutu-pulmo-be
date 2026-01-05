import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DoctorScheduleService } from './doctor-schedule.service';
import { SlotGeneratorService } from './slot-generator.service';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { DoctorOwnershipGuard } from '../core/auth/guards/doctor-ownership.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { CreateDoctorScheduleDto, UpdateDoctorScheduleDto, BulkCreateDoctorSchedulesDto, BulkHolidayScheduleDto } from './dto/doctor-schedule.dto';
import { GenerateSlotsDto } from './dto/time-slot.dto';
import { DoctorScheduleResponseDto, TimeSlotResponseDto } from './dto/schedule-response.dto';

@ApiTags('Doctor Schedules')
@ApiBearerAuth()
@Controller('doctors/:doctorId/schedules')
export class DoctorScheduleController {
  constructor(
    private readonly scheduleService: DoctorScheduleService,
    private readonly slotGeneratorService: SlotGeneratorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả lịch làm việc của bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách lịch làm việc',
    type: [DoctorScheduleResponseDto],
  })
  async findByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    const result = await this.scheduleService.findByDoctorId(doctorId);
    const enrichedSchedules = await this.scheduleService.enrichSchedulesWithEffectiveFee(result.data ?? []);
    result.data = enrichedSchedules;
    return result;
  }

  @Get('available')
  @ApiOperation({ summary: 'Lấy lịch làm việc còn trống của bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({ name: 'dayOfWeek', description: 'Ngày trong tuần (0-6)', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách lịch còn trống (đã filter theo effectiveDate)',
    type: [DoctorScheduleResponseDto],
  })
  async findAvailable(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('dayOfWeek') dayOfWeek?: string,
  ) {
    const day = dayOfWeek ? parseInt(dayOfWeek, 10) : undefined;
    const result = await this.scheduleService.findAvailableByDoctor(doctorId, day);
    const enrichedSchedules = await this.scheduleService.enrichSchedulesWithEffectiveFee(result.data ?? []);
    result.data = enrichedSchedules;
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một lịch làm việc' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Schedule ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chi tiết lịch làm việc',
    type: DoctorScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy lịch',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.scheduleService.findById(id);
    if (result.data) {
      const enriched = await this.scheduleService.enrichScheduleWithEffectiveFee(result.data);
      result.data = enriched;
    }
    return result;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Thêm lịch làm việc cho bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Thêm lịch thành công',
    type: DoctorScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ (giờ không đúng, break time sai, v.v.)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Chưa đăng nhập',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hoặc không phải lịch của mình',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Trùng lịch với lịch hiện có',
  })
  create(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateDoctorScheduleDto,
  ) {
    return this.scheduleService.create(doctorId, dto);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Thêm nhiều lịch làm việc cùng lúc (tối đa 20)',
    description: 'Cho phép tạo nhiều lịch làm việc trong 1 request. Ví dụ: Thứ 2-6, sáng 9h-12h và chiều 13h-17h.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo các lịch thành công',
    type: [DoctorScheduleResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Trùng lịch với lịch hiện có hoặc giữa các lịch trong request',
  })
  createMany(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: BulkCreateDoctorSchedulesDto,
  ) {
    return this.scheduleService.createMany(doctorId, dto.schedules);
  }

  @Post('bulk-holiday')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Tạo lịch nghỉ lễ/Tết cho nhiều ngày cùng lúc',
    description: 'Hỗ trợ tạo lịch BLOCK_OUT (nghỉ hoàn toàn) hoặc HOLIDAY (làm giờ giảm) cho các ngày trong tuần'
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo lịch nghỉ lễ thành công',
    type: [DoctorScheduleResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Trùng lịch với lịch ưu tiên cao hơn',
  })
  createBulkHoliday(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: BulkHolidayScheduleDto,
  ) {
    return this.scheduleService.createBulkHoliday(doctorId, dto);
  }

  @Post('generate-slots')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Tự động tạo time slots từ tất cả lịch làm việc của bác sĩ',
    description: 'Tạo time slots cho khoảng thời gian từ startDate đến endDate. Hệ thống sẽ tự động áp dụng tất cả lịch làm việc có hiệu lực, ưu tiên theo priority cao nhất cho mỗi ngày.'
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo các time slots thành công',
    type: [TimeSlotResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ hoặc vượt quá 90 ngày',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hoặc không phải lịch của mình',
  })
  generateSlotsForDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: GenerateSlotsDto,
  ) {
    return this.slotGeneratorService.generateAndSaveSlotsForDoctor(
      doctorId,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
  }

  @Post(':scheduleId/generate-slots')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tự động tạo time slots từ schedule template' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID dùng làm template' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo các time slots thành công',
    type: [TimeSlotResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ, schedule không khả dụng, hoặc vượt quá 90 ngày',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hoặc không phải lịch của mình',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy schedule',
  })
  generateSlots(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: GenerateSlotsDto,
  ) {
    return this.slotGeneratorService.generateAndSaveSlots(
      scheduleId,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật lịch làm việc' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Schedule ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật thành công',
    type: DoctorScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy lịch',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hoặc không phải lịch của mình',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Trùng lịch với lịch hiện có',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorScheduleDto,
  ) {
    return this.scheduleService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xóa lịch làm việc' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Schedule ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xóa thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy lịch',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền hoặc không phải lịch của mình',
  })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleService.delete(id);
  }
}

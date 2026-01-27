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
import {
  CreateDoctorScheduleDto,
  UpdateDoctorScheduleDto,
  BulkCreateDoctorSchedulesDto,
  BulkUpdateDoctorSchedulesDto,
} from './dto/doctor-schedule.dto';
import {
  CreateFlexibleScheduleDto,
  UpdateFlexibleScheduleDto,
} from './dto/flexible-schedule.dto';
import { CreateTimeOffDto, UpdateTimeOffDto } from './dto/time-off.dto';
import {
  PreviewFlexibleScheduleConflictsDto,
  PreviewTimeOffConflictsDto,
  PreviewConflictsResponseDto,
} from './dto/preview-conflicts.dto';
import { GenerateSlotsDto } from './dto/time-slot.dto';
import {
  DoctorScheduleResponseDto,
  TimeSlotResponseDto,
} from './dto/schedule-response.dto';
import { ScheduleType } from 'src/modules/common/enums/schedule-type.enum';

@ApiTags('Doctor Schedules')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, DoctorOwnershipGuard)
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
  async findByDoctor(@Param('doctorId', ParseUUIDPipe) doctorId: string) {
    const result = await this.scheduleService.findByDoctorId(doctorId);
    const enrichedSchedules =
      await this.scheduleService.enrichSchedulesWithEffectiveFee(
        result.data ?? [],
      );
    result.data = enrichedSchedules;
    return result;
  }

  @Get('available')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy lịch làm việc còn trống của bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({
    name: 'dayOfWeek',
    description: 'Ngày trong tuần (0-6)',
    required: false,
  })
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
    const result = await this.scheduleService.findAvailableByDoctor(
      doctorId,
      day,
    );
    const enrichedSchedules =
      await this.scheduleService.enrichSchedulesWithEffectiveFee(
        result.data ?? [],
      );
    result.data = enrichedSchedules;
    return result;
  }

  // ========================================
  // REGULAR SCHEDULE ENDPOINTS
  // ========================================

  @Post('regular')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Thêm lịch làm việc cố định (REGULAR)',
    description:
      'Lịch cố định lặp lại theo tuần. Ví dụ: Thứ 2 hàng tuần từ 8h-12h. Lịch này sẽ áp dụng từ effectiveFrom đến effectiveUntil.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo lịch cố định thành công',
    type: DoctorScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Dữ liệu không hợp lệ (giờ không đúng, slotDuration <= 0, dayOfWeek không hợp lệ)',
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
  createRegularSchedule(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateDoctorScheduleDto,
  ) {
    return this.scheduleService.createRegular(doctorId, dto);
  }

  @Post('regular/bulk')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Thêm nhiều lịch làm việc cố định cùng lúc (tối đa 20)',
    description:
      'Cho phép tạo nhiều lịch REGULAR trong 1 request. Ví dụ: Thứ 2-6, sáng 9h-12h và chiều 13h-17h. Các lịch này sẽ lặp lại hàng tuần.',
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
    return this.scheduleService.createManyRegular(doctorId, dto.schedules);
  }

  @Patch('regular/bulk')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cập nhật nhiều lịch làm việc cố định cùng lúc (tối đa 20)',
    description:
      'Cho phép cập nhật nhiều lịch REGULAR trong 1 request. Mỗi item cần có id và các trường cần cập nhật. Thay đổi về thời gian/ngày sẽ tự động đồng bộ lại time slots.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật các lịch thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ hoặc lịch không phải REGULAR',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy một hoặc nhiều lịch',
  })
  updateManyRegular(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: BulkUpdateDoctorSchedulesDto,
  ) {
    return this.scheduleService.updateManyRegular(doctorId, dto.schedules);
  }

  @Get('regular')
  @ApiOperation({ summary: 'Lấy danh sách lịch làm việc cố định (REGULAR)' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách lịch cố định',
    type: [DoctorScheduleResponseDto],
  })
  async findRegularSchedules(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.scheduleService.findByDoctorIdAndType(
      doctorId,
      ScheduleType.REGULAR,
    );
  }

  @Patch('regular/:id')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật lịch làm việc cố định (REGULAR)' })
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
    status: HttpStatus.BAD_REQUEST,
    description: 'Lịch này không phải là lịch cố định (REGULAR)',
  })
  updateRegularSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorScheduleDto,
  ) {
    return this.scheduleService.updateRegular(id, dto);
  }

  @Delete('regular/:id')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xóa lịch làm việc cố định (REGULAR)' })
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
    status: HttpStatus.BAD_REQUEST,
    description: 'Lịch này không phải là lịch cố định (REGULAR)',
  })
  deleteRegularSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleService.deleteRegular(id);
  }

  @Post('generate-slots')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Tự động tạo time slots từ tất cả lịch làm việc của bác sĩ',
    description:
      'Tạo time slots cho khoảng thời gian từ startDate đến endDate. Hệ thống sẽ tự động áp dụng tất cả lịch làm việc có hiệu lực, ưu tiên theo priority cao nhất cho mỗi ngày.',
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

  // ========================================
  // FLEXIBLE SCHEDULE ENDPOINTS
  // ========================================

  @Get('flexible')
  @ApiOperation({ summary: 'Lấy danh sách lịch làm việc linh hoạt (FLEXIBLE)' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách lịch linh hoạt',
    type: [DoctorScheduleResponseDto],
  })
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  async findFlexibleSchedules(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.scheduleService.findByDoctorIdAndType(
      doctorId,
      ScheduleType.FLEXIBLE,
    );
  }

  @Post('flexible')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Thêm lịch làm việc linh hoạt cho ngày cụ thể',
    description:
      'Lịch này chỉ áp dụng cho ngày đã chọn, không lặp lại. Nếu có lịch hẹn trùng, chúng sẽ bị hủy tự động.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo lịch linh hoạt thành công',
    type: DoctorScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Trùng lịch với lịch hiện có',
  })
  createFlexibleSchedule(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateFlexibleScheduleDto,
  ) {
    return this.scheduleService.createFlexibleSchedule(doctorId, dto);
  }

  @Post('flexible/preview-conflicts')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Xem trước các lịch hẹn sẽ bị ảnh hưởng khi tạo lịch linh hoạt',
    description:
      'API này cho phép doctor xem trước appointments nào sẽ bị hủy và bao nhiêu slots sẽ bị thay thế trước khi tạo lịch linh hoạt.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách appointments và slots bị ảnh hưởng',
    type: PreviewConflictsResponseDto,
  })
  previewFlexibleConflicts(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: PreviewFlexibleScheduleConflictsDto,
  ) {
    return this.scheduleService.previewFlexibleScheduleConflicts(doctorId, dto);
  }

  @Patch('flexible/:id')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật lịch làm việc linh hoạt' })
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
    status: HttpStatus.BAD_REQUEST,
    description: 'Lịch này không phải là lịch linh hoạt',
  })
  updateFlexibleSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlexibleScheduleDto,
  ) {
    return this.scheduleService.updateFlexibleSchedule(id, dto);
  }

  @Delete('flexible/:id')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xóa lịch làm việc linh hoạt (FLEXIBLE)' })
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
    status: HttpStatus.BAD_REQUEST,
    description: 'Lịch này không phải là lịch linh hoạt (FLEXIBLE)',
  })
  deleteFlexibleSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleService.deleteFlexibleSchedule(id);
  }

  // ========================================
  // TIME-OFF SCHEDULE ENDPOINTS
  // ========================================

  @Get('time-off')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy danh sách lịch nghỉ (TIME_OFF)' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách lịch nghỉ',
    type: [DoctorScheduleResponseDto],
  })
  async findTimeOffSchedules(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.scheduleService.findByDoctorIdAndType(
      doctorId,
      ScheduleType.TIME_OFF,
    );
  }

  @Post('time-off')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Thêm lịch nghỉ',
    description:
      'Khách hàng sẽ không thể đặt lịch khám hoặc tư vấn vào khung giờ nghỉ. Các lịch đã được bệnh nhân đặt trước đó cũng sẽ bị hủy.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo lịch nghỉ thành công',
    type: DoctorScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Trùng lịch với lịch hiện có',
  })
  createTimeOff(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateTimeOffDto,
  ) {
    return this.scheduleService.createTimeOff(doctorId, dto);
  }

  @Post('time-off/preview-conflicts')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Xem trước các lịch hẹn sẽ bị ảnh hưởng khi tạo lịch nghỉ',
    description:
      'API này cho phép doctor xem trước appointments nào sẽ bị hủy và bao nhiêu slots sẽ bị tắt trước khi tạo lịch nghỉ.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách appointments và slots bị ảnh hưởng',
    type: PreviewConflictsResponseDto,
  })
  previewTimeOffConflicts(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: PreviewTimeOffConflictsDto,
  ) {
    return this.scheduleService.previewTimeOffConflicts(doctorId, dto);
  }

  @Patch('time-off/:id')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật lịch nghỉ' })
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
    status: HttpStatus.BAD_REQUEST,
    description: 'Lịch này không phải là lịch nghỉ',
  })
  updateTimeOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeOffDto,
  ) {
    return this.scheduleService.updateTimeOff(id, dto);
  }

  @Delete('time-off/:id')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xóa lịch nghỉ (TIME_OFF)' })
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
    status: HttpStatus.BAD_REQUEST,
    description: 'Lịch này không phải là lịch nghỉ (TIME_OFF)',
  })
  deleteTimeOff(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleService.deleteTimeOff(id);
  }
}

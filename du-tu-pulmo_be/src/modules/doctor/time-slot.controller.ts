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
import { TimeSlotService } from './time-slot.service';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { DoctorOwnershipGuard } from '../core/auth/guards/doctor-ownership.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import {
  CreateTimeSlotDto,
  BulkCreateTimeSlotsDto,
  UpdateTimeSlotDto,
  BookTimeSlotDto,
  ToggleSlotAvailabilityDto,
  BulkToggleSlotsDto,
  DisableSlotsForDayDto,
} from './dto/time-slot.dto';
import { TimeSlotResponseDto } from './dto/schedule-response.dto';

@ApiTags('Time Slots')
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
  findByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ) {
    return this.timeSlotService.findByDoctorId(doctorId);
  }

  @Get('available')
  @ApiOperation({ summary: 'Lấy các time slots còn trống theo ngày' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({ name: 'date', description: 'Ngày cần tìm (YYYY-MM-DD)', required: true })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách time slots còn trống',
    type: [TimeSlotResponseDto],
  })
  findAvailable(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') dateStr: string,
  ) {
    if (!dateStr) {
      throw new BadRequestException('Ngày không được để trống');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ, sử dụng format YYYY-MM-DD');
    }
    return this.timeSlotService.findAvailableSlotsByDate(doctorId, date);
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
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeSlotService.findById(id);
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
  create(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateTimeSlotDto,
  ) {
    return this.timeSlotService.create(doctorId, dto);
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
  createMany(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: BulkCreateTimeSlotsDto,
  ) {
    return this.timeSlotService.createMany(doctorId, dto.slots);
  }

  @Post(':id/book')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Đặt một time slot' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Time Slot ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đặt thành công',
    type: TimeSlotResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Time slot không còn trống',
  })
  book(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookTimeSlotDto,
  ) {
    return this.timeSlotService.bookSlot(id, dto.appointmentId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Hủy đặt time slot' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Time Slot ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hủy thành công',
    type: TimeSlotResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Time slot không có booking để hủy',
  })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeSlotService.cancelBooking(id);
  }

  /**
   * 🆕 API: Toggle 1 slot manually
   * PATCH /doctors/:doctorId/time-slots/:id/availability
   */
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
  toggleAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleSlotAvailabilityDto,
  ) {
    return this.timeSlotService.toggleSlotAvailability(id, dto.isAvailable);
  }

  /**
   * 🆕 API: Bulk toggle nhiều slots
   * POST /doctors/:doctorId/time-slots/bulk-toggle
   */
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
  bulkToggle(
    @Body() dto: BulkToggleSlotsDto,
  ) {
    return this.timeSlotService.bulkToggleSlots(dto.slotIds, dto.isAvailable);
  }

  /**
   * 🆕 API: Helper - Tắt tất cả slots của bác sĩ trong 1 ngày
   * POST /doctors/:doctorId/time-slots/disable-day
   */
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeSlotDto,
  ) {
    return this.timeSlotService.update(id, dto);
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

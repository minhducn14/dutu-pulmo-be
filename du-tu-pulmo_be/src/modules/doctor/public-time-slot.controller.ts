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
} from '@nestjs/swagger';
import { TimeSlotService } from './time-slot.service';
import { TimeSlotResponseDto } from './dto/schedule-response.dto';

@ApiTags('Public Time Slots')
@Controller('public/doctors/:doctorId/time-slots')
export class PublicTimeSlotController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  /**
   * GET /public/doctors/:doctorId/time-slots
   * - Không có query params: trả về tất cả slots
   * - Có startDate & endDate: trả về slots trong khoảng
   * - Có startDate & endDate & grouped=true: trả về grouped by date
   */
  @Get()
  @ApiOperation({ 
    summary: 'Lấy time slots của bác sĩ',
    description: 'Có thể lọc theo khoảng thời gian và group theo ngày' 
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({
    name: 'startDate',
    description: 'Ngày bắt đầu (YYYY-MM-DD) - optional',
    required: false,
  })
  @ApiQuery({
    name: 'endDate',
    description: 'Ngày kết thúc (YYYY-MM-DD) - optional',
    required: false,
  })
  @ApiQuery({
    name: 'grouped',
    description: 'true để group theo ngày và buổi',
    type: Boolean,
    default: true,
    required: false,
  })
  async findByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('grouped') grouped?: boolean,
  ) {
    // Case 1: Lọc theo khoảng + group
    if (startDateStr && endDateStr && grouped === true) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestException('Ngày không hợp lệ');
      }

      return this.timeSlotService.findSlotsGroupedByDate(doctorId, startDate, endDate);
    }

    // Case 2: Lọc theo khoảng (không group)
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestException('Ngày không hợp lệ');
      }

      const slots = await this.timeSlotService.findSlotsInRange(
        doctorId, 
        startDate, 
        endDate
      );
      return {
        code: 200,
        message: 'SUCCESS',
        data: slots,
      };
    }

    // Case 3: Lấy tất cả
    return this.timeSlotService.findByDoctorId(doctorId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Đếm số slots có sẵn theo từng ngày' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async countSlots(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
  ) {
    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('startDate và endDate là bắt buộc');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }

    return this.timeSlotService.countSlotsByDateRange(doctorId, startDate, endDate);
  }

  /**
   * GET /public/doctors/:doctorId/time-slots/available?date=YYYY-MM-DD
   * Lấy slots của 1 ngày, có thể group theo buổi
   */
  @Get('available')
  @ApiOperation({ summary: 'Lấy các time slots còn trống theo ngày' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({ name: 'date', required: true, description: 'Ngày (YYYY-MM-DD)' })
  @ApiQuery({ 
    name: 'grouped', 
    required: false, 
    description: 'true để group theo buổi sáng/chiều' 
  })
  findAvailable(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') dateStr: string,
    @Query('grouped') grouped?: string,
  ) {
    if (!dateStr) {
      throw new BadRequestException('Ngày không được để trống');
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }

    // Nếu muốn group theo buổi
    if (grouped === 'true') {
      return this.timeSlotService.findAvailableSlotsByDateGrouped(doctorId, date);
    }

    // Không group
    return this.timeSlotService.findAvailableSlotsByDate(doctorId, date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một time slot' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiParam({ name: 'id', description: 'Time Slot ID (UUID)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeSlotService.findById(id);
  }
}
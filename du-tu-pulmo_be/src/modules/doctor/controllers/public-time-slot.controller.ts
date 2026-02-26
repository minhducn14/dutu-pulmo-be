import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  Controller,
  Get,
  Param,
  HttpStatus,
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
import { TimeSlotService } from '@/modules/doctor/services/time-slot.service';
import { TimeSlotResponseDto } from '@/modules/doctor/dto/schedule-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Time Slots')
@Controller('public/doctors/:doctorId/time-slots')
export class PublicTimeSlotController {
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
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
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

  @Get('summary')
  @ApiOperation({
    summary:
      'Lấy tóm tắt số lượng slot còn trống (Mặc định 7 ngày từ hiện tại)',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({
    name: 'from',
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    required: false,
  })
  @ApiQuery({
    name: 'to',
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách tóm tắt',
  })
  async getAvailabilitySummary(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    let fromDate: Date;
    let toDate: Date;

    if (fromStr) {
      fromDate = new Date(fromStr);
    } else {
      fromDate = new Date();
    }

    if (toStr) {
      toDate = new Date(toStr);
    } else {
      toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 6);
    }

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    return this.timeSlotService.getAvailabilitySummary(
      doctorId,
      fromDate,
      toDate,
    );
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
}

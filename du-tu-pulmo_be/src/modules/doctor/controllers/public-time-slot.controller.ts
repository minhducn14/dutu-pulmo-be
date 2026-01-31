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
}

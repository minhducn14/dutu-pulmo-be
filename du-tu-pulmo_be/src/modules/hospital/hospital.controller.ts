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
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { HospitalService } from './hospital.service';
import {
  CreateHospitalDto,
  UpdateHospitalDto,
  HospitalQueryDto,
} from './dto/hospital.dto';
import { HospitalResponseDto } from './dto/hospital-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination.dto';
import { DoctorResponseDto } from '../doctor/dto/doctor-response.dto';
import { Doctor } from '../doctor/entities/doctor.entity';

@ApiTags('Hospitals')
@Controller('hospitals')
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách bệnh viện/phòng khám',
    description: 'Hỗ trợ pagination, search theo tên/mã, filter theo thành phố',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm kiếm theo tên hoặc mã',
  })
  @ApiQuery({
    name: 'city',
    required: false,
    description: 'Lọc theo thành phố',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách bệnh viện',
    type: PaginatedResponseDto,
  })
  async findAll(
    @Query() query: HospitalQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<HospitalResponseDto>>> {
    const response = await this.hospitalService.findAll(query);
    const data = response.data ?? {
      data: [],
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
    const items = (data.data ?? []).map((hospital) =>
      HospitalResponseDto.fromEntity(hospital),
    );
    const paginated = new PaginatedResponseDto(
      items,
      data.total,
      data.page,
      data.limit,
    );
    return new ResponseCommon(response.code, response.message, paginated);
  }

  @Get('cities')
  @ApiOperation({ summary: 'Lấy danh sách các thành phố có bệnh viện' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách thành phố',
    type: [String],
  })
  getCities(): Promise<ResponseCommon<string[]>> {
    return this.hospitalService.getCities();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết bệnh viện' })
  @ApiParam({ name: 'id', description: 'Hospital ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin bệnh viện',
    type: HospitalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bệnh viện',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<HospitalResponseDto>> {
    const response = await this.hospitalService.findById(id);
    return new ResponseCommon(
      response.code,
      response.message,
      HospitalResponseDto.fromEntity(response.data!),
    );
  }

  @Get('code/:hospitalCode')
  @ApiOperation({ summary: 'Lấy bệnh viện theo mã' })
  @ApiParam({
    name: 'hospitalCode',
    description: 'Mã bệnh viện (ví dụ: BVTA-001)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin bệnh viện',
    type: HospitalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bệnh viện',
  })
  async findByCode(
    @Param('hospitalCode') hospitalCode: string,
  ): Promise<ResponseCommon<HospitalResponseDto>> {
    const response = await this.hospitalService.findByCode(hospitalCode);
    return new ResponseCommon(
      response.code,
      response.message,
      HospitalResponseDto.fromEntity(response.data!),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tạo bệnh viện mới (Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo bệnh viện thành công',
    type: HospitalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Mã bệnh viện đã tồn tại',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Chưa đăng nhập',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền (chỉ Admin)',
  })
  async create(
    @Body() dto: CreateHospitalDto,
  ): Promise<ResponseCommon<HospitalResponseDto>> {
    const response = await this.hospitalService.create(dto);
    return new ResponseCommon(
      response.code,
      response.message,
      HospitalResponseDto.fromEntity(response.data!),
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật bệnh viện (Admin only)' })
  @ApiParam({ name: 'id', description: 'Hospital ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật thành công',
    type: HospitalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bệnh viện',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Mã bệnh viện đã tồn tại',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHospitalDto,
  ): Promise<ResponseCommon<HospitalResponseDto>> {
    const response = await this.hospitalService.update(id, dto);
    return new ResponseCommon(
      response.code,
      response.message,
      HospitalResponseDto.fromEntity(response.data!),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Xóa bệnh viện (Soft delete - Admin only)',
    description:
      'Thực hiện soft delete, dữ liệu vẫn tồn tại trong database nhưng bị ẩn',
  })
  @ApiParam({ name: 'id', description: 'Hospital ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xóa thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bệnh viện',
  })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<null>> {
    return this.hospitalService.delete(id);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Khôi phục bệnh viện đã xóa (Admin only)' })
  @ApiParam({ name: 'id', description: 'Hospital ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Khôi phục thành công',
    type: HospitalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bệnh viện',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bệnh viện chưa bị xóa',
  })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<HospitalResponseDto>> {
    const response = await this.hospitalService.restore(id);
    return new ResponseCommon(
      response.code,
      response.message,
      HospitalResponseDto.fromEntity(response.data!),
    );
  }

  @Get(':id/doctors')
  @ApiOperation({
    summary: 'Lấy danh sách bác sĩ của bệnh viện',
    description:
      'Trả về danh sách bác sĩ làm việc tại bệnh viện với pagination',
  })
  @ApiParam({ name: 'id', description: 'Hospital ID (UUID)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách bác sĩ của bệnh viện',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bệnh viện',
  })
  async getDoctors(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ResponseCommon<PaginatedResponseDto<DoctorResponseDto>>> {
    const response = await this.hospitalService.getDoctorsByHospitalId(
      id,
      page || 1,
      limit || 20,
    );
    const fallback = new PaginatedResponseDto<DoctorResponseDto>(
      [],
      0,
      page || 1,
      limit || 20,
    );
    const paginated = (response.data ??
      fallback) as PaginatedResponseDto<Doctor>;
    const items = (paginated.items ?? []).map((doc) =>
      DoctorResponseDto.fromEntity(doc),
    );
    return new ResponseCommon(response.code, response.message, {
      items,
      meta: paginated.meta,
    });
  }
}

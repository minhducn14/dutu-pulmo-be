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
import {
  HospitalResponseDto,
  PaginatedHospitalResponseDto,
} from './dto/hospital-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { FacilityTypeEnum } from '../common/enums/facility-type.enum';

@ApiTags('Hospitals')
@Controller('hospitals')
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách bệnh viện/phòng khám',
    description: 'Hỗ trợ pagination, search theo tên/mã/địa chỉ/tỉnh/phường, filter theo loại cơ sở và tỉnh',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm kiếm theo tên, mã, địa chỉ, tỉnh/thành phố, phường/xã',
  })
  @ApiQuery({
    name: 'facilityType',
    required: false,
    enum: FacilityTypeEnum,
    description: 'Lọc theo loại cơ sở y tế',
  })
  @ApiQuery({
    name: 'provinceCode',
    required: false,
    description: 'Lọc theo mã tỉnh/thành phố',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách bệnh viện',
    type: PaginatedHospitalResponseDto,
  })
  findAll(@Query() query: HospitalQueryDto) {
    return this.hospitalService.findAll(query);
  }

  @Get('facility-types')
  @ApiOperation({ summary: 'Lấy danh sách các loại cơ sở y tế' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách loại cơ sở y tế',
    type: [String],
  })
  getFacilityTypes() {
    return this.hospitalService.getFacilityTypes();
  }

  @Get('provinces')
  @ApiOperation({ summary: 'Lấy danh sách các tỉnh/thành phố có bệnh viện' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách tỉnh/thành phố',
  })
  getProvinces() {
    return this.hospitalService.getProvinces();
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
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.hospitalService.findById(id);
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
  findByCode(@Param('hospitalCode') hospitalCode: string) {
    return this.hospitalService.findByCode(hospitalCode);
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
  create(@Body() dto: CreateHospitalDto) {
    return this.hospitalService.create(dto);
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHospitalDto,
  ) {
    return this.hospitalService.update(id, dto);
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
  delete(@Param('id', ParseUUIDPipe) id: string) {
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
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.hospitalService.restore(id);
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
  getDoctors(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.hospitalService.getDoctorsByHospitalId(
      id,
      page || 1,
      limit || 20,
    );
  }
}

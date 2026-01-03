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
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SpecialtyService } from './specialty.service';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { RoleEnum } from '../common/enums/role.enum';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
import { Specialty } from './entities/specialty.entity';
import { SubSpecialty } from './entities/sub-specialty.entity';

@ApiTags('Specialties')
@Controller('specialties')
export class SpecialtyController {
  constructor(private readonly specialtyService: SpecialtyService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách chuyên khoa' })
  @ApiResponse({ status: HttpStatus.OK, type: [Specialty] })
  async findAllSpecialties(): Promise<ResponseCommon<Specialty[]>> {
    return this.specialtyService.findAllSpecialties();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chuyên khoa theo ID' })
  @ApiParam({ name: 'id', description: 'Specialty ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: Specialty })
  async findOneSpecialty(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<Specialty>> {
    const response = await this.specialtyService.findOneSpecialty(id);
    if (!response.data) {
      throw new NotFoundException('Không tìm thấy chuyên khoa');
    }
    return new ResponseCommon(response.code, response.message, response.data);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo chuyên khoa mới (Admin)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: Specialty })
  async createSpecialty(
    @Body() dto: CreateSpecialtyDto,
  ): Promise<ResponseCommon<Specialty>> {
    return this.specialtyService.createSpecialty(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật chuyên khoa (Admin)' })
  @ApiParam({ name: 'id', description: 'Specialty ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: Specialty })
  async updateSpecialty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialtyDto,
  ): Promise<ResponseCommon<Specialty | null>> {
    return this.specialtyService.updateSpecialty(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa chuyên khoa (Admin - soft delete)' })
  @ApiParam({ name: 'id', description: 'Specialty ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK })
  async removeSpecialty(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<null>> {
    return this.specialtyService.removeSpecialty(id);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Khôi phục chuyên khoa đã xóa (Admin)' })
  @ApiParam({ name: 'id', description: 'Specialty ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: Specialty })
  async restoreSpecialty(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<Specialty | null>> {
    return this.specialtyService.restoreSpecialty(id);
  }

  @Get(':id/sub-specialties')
  @ApiOperation({ summary: 'Lấy danh sách chuyên khoa phụ theo Specialty ID' })
  @ApiParam({ name: 'id', description: 'Specialty ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: [SubSpecialty] })
  async findSubSpecialtiesBySpecialtyId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<SubSpecialty[]>> {
    return this.specialtyService.findSubSpecialtiesBySpecialtyId(id);
  }
}

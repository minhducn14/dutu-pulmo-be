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
import { CreateSubSpecialtyDto } from './dto/create-sub-specialty.dto';
import { UpdateSubSpecialtyDto } from './dto/update-sub-specialty.dto';
import { SubSpecialty } from './entities/sub-specialty.entity';

@ApiTags('SubSpecialties')
@Controller('sub-specialties')
export class SubSpecialtyController {
  constructor(private readonly specialtyService: SpecialtyService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả chuyên khoa phụ' })
  @ApiResponse({ status: HttpStatus.OK, type: [SubSpecialty] })
  async findAll(): Promise<ResponseCommon<SubSpecialty[]>> {
    return this.specialtyService.findAllSubSpecialties();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chuyên khoa phụ theo ID' })
  @ApiParam({ name: 'id', description: 'SubSpecialty ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: SubSpecialty })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseCommon<SubSpecialty>> {
    const response = await this.specialtyService.findOneSubSpecialty(id);
    if (!response.data) {
      throw new NotFoundException('Không tìm thấy chuyên khoa phụ');
    }
    return new ResponseCommon(response.code, response.message, response.data);
  }

}

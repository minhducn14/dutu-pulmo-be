import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnumService } from './enum.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@ApiTags('Enum - Danh mục')
@Controller('enums')
export class EnumController {
  constructor(private readonly enumService: EnumService) {}

  @Get('countries')
  @ApiOperation({ summary: 'Lấy danh sách quốc gia' })
  async getCountries(
    @Query() paginationDto: PaginationDto,
  ): Promise<ResponseCommon> {
    return this.enumService.getCountries(paginationDto);
  }

  @Get('ethnicities')
  @ApiOperation({ summary: 'Lấy danh sách dân tộc' })
  async getEthnicities(
    @Query() paginationDto: PaginationDto,
  ): Promise<ResponseCommon> {
    return this.enumService.getEthnicities(paginationDto);
  }

  @Get('occupations')
  @ApiOperation({ summary: 'Lấy danh sách nghề nghiệp' })
  async getOccupations(
    @Query() paginationDto: PaginationDto,
  ): Promise<ResponseCommon> {
    return this.enumService.getOccupations(paginationDto);
  }
}

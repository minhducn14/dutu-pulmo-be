import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EnumService } from '@/modules/enum/enum.service';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { EnumItemDto } from '@/modules/enum/dto/enum-item.dto';
import { EnumQueryDto } from '@/modules/enum/dto/enum-query.dto';

@ApiTags('Enum - Danh mục')
@Controller('enums')
export class EnumController {
  constructor(private readonly enumService: EnumService) {}

  @Get('countries')
  @ApiOperation({ summary: 'Lấy danh sách quốc gia' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách quốc gia với phân trang',
    type: PaginatedResponseDto,
  })
  async getCountries(
    @Query() query: EnumQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<EnumItemDto>>> {
    return this.enumService.getCountries(query);
  }

  @Get('ethnicities')
  @ApiOperation({ summary: 'Lấy danh sách dân tộc' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách dân tộc với phân trang',
    type: PaginatedResponseDto,
  })
  async getEthnicities(
    @Query() query: EnumQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<EnumItemDto>>> {
    return this.enumService.getEthnicities(query);
  }

  @Get('occupations')
  @ApiOperation({ summary: 'Lấy danh sách nghề nghiệp' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách nghề nghiệp với phân trang',
    type: PaginatedResponseDto,
  })
  async getOccupations(
    @Query() query: EnumQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<EnumItemDto>>> {
    return this.enumService.getOccupations(query);
  }
}

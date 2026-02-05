import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { MedicineService } from '@/modules/medical/medicine.service';
import { CreateMedicineDto } from '@/modules/medical/dto/create-medicine.dto';
import { FilterMedicineDto } from '@/modules/medical/dto/filter-medicine.dto';
import { UpdateMedicineDto } from '@/modules/medical/dto/update-medicine.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Medicine } from '@/modules/medical/entities/medicine.entity';
import {
  MedicineResponseDto,
  PaginatedMedicineResponseDto,
} from '@/modules/medical/dto/medical-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';

@ApiTags('Medicines')
@Controller('medicines')
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}

  private toDto(entity: Medicine): MedicineResponseDto {
    return {
      id: entity.id,
      code:
        entity.registrationNumber || entity.id.substring(0, 8).toUpperCase(),
      name: entity.name,
      genericName: entity.activeIngredient,
      manufacturer: entity.manufacturer,
      packing: entity.packing,
      strength: entity.content,
      unit: entity.unit.toString(),
      category: entity.category,
      description: entity.description,
      isActive: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new medicine/product' })
  @ApiResponse({
    status: 201,
    description: 'Created successfully',
    type: MedicineResponseDto,
  })
  async create(
    @Body() createMedicineDto: CreateMedicineDto,
  ): Promise<ResponseCommon<MedicineResponseDto>> {
    const result = await this.medicineService.create(createMedicineDto);
    const dto = this.toDto(result.data!);
    return new ResponseCommon(result.code, result.message, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and search medicines' })
  @ApiResponse({
    status: 200,
    description: 'List of medicines',
    type: PaginatedMedicineResponseDto,
  })
  async findAll(
    @Query() filterDto: FilterMedicineDto,
  ): Promise<ResponseCommon<PaginatedMedicineResponseDto>> {
    const result = await this.medicineService.findAll(filterDto);
    const fallback = new PaginatedResponseDto<Medicine>(
      [],
      0,
      filterDto.page || 1,
      filterDto.limit || 10,
    );
    const pageDto = result.data ?? fallback;
    const items = (pageDto.items || []).map((m) => this.toDto(m));

    return new ResponseCommon(result.code, result.message, {
      items,
      meta: pageDto.meta,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medicine details' })
  @ApiResponse({
    status: 200,
    description: 'Medicine details',
    type: MedicineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async findOne(
    @Param('id') id: string,
  ): Promise<ResponseCommon<MedicineResponseDto>> {
    const result = await this.medicineService.findOne(id);
    if (!result.data) throw new NotFoundException('Medicine not found');
    const dto = this.toDto(result.data);
    return new ResponseCommon(result.code, result.message, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update medicine' })
  @ApiResponse({
    status: 200,
    description: 'Updated successfully',
    type: MedicineResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateMedicineDto: UpdateMedicineDto,
  ): Promise<ResponseCommon<MedicineResponseDto>> {
    const result = await this.medicineService.update(id, updateMedicineDto);
    const dto = this.toDto(result.data!);
    return new ResponseCommon(result.code, result.message, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete (deactivate) medicine' })
  @ApiResponse({ status: 200, description: 'Deactivated successfully' })
  async remove(@Param('id') id: string): Promise<ResponseCommon<boolean>> {
    return this.medicineService.remove(id);
  }
}

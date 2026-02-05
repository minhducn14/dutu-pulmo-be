import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  GoodsType,
  MedicineGroup,
  ProductCategory,
} from '@/modules/medical/enums/medicine.enums';
import { PaginationDto } from '@/common/dto/pagination.dto';

const toStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',');
  return undefined;
};

export class FilterMedicineDto extends PaginationDto {
  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: GoodsType, isArray: true, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return toStringArray(value);
  })
  @IsEnum(GoodsType, { each: true })
  goodsType?: GoodsType[];

  @ApiPropertyOptional({ enum: ProductCategory, isArray: true, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return toStringArray(value);
  })
  @IsEnum(ProductCategory, { each: true })
  category?: ProductCategory[];

  @ApiPropertyOptional({ enum: MedicineGroup, isArray: true, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return toStringArray(value);
  })
  @IsEnum(MedicineGroup, { each: true })
  group?: MedicineGroup[];

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value === 'boolean') return value;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}

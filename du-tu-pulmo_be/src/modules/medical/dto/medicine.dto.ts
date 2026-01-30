import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  GoodsType,
  MedicineGroup,
  ProductCategory,
  RouteOfAdministration,
  UnitOfMeasure,
} from '@/modules/medical/enums/medicine.enums';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Transform } from 'class-transformer';

export class CreateMedicineDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  activeIngredient?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  content?: string;

  @ApiProperty({ enum: GoodsType, default: GoodsType.MEDICINE })
  @IsEnum(GoodsType)
  goodsType: GoodsType;

  @ApiProperty({ enum: ProductCategory, required: false })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiProperty({ enum: MedicineGroup, required: false })
  @IsOptional()
  @IsEnum(MedicineGroup)
  group?: MedicineGroup;

  @ApiProperty({ enum: RouteOfAdministration, required: false })
  @IsOptional()
  @IsEnum(RouteOfAdministration)
  route?: RouteOfAdministration;

  @ApiProperty({ enum: UnitOfMeasure })
  @IsEnum(UnitOfMeasure)
  unit: UnitOfMeasure;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  packing?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  manufacturer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryOfOrigin?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  guide?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}

export class UpdateMedicineDto extends PartialType(CreateMedicineDto) {}

export class FilterMedicineDto extends PaginationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: GoodsType, isArray: true, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return toStringArray(value);
  })
  @IsEnum(GoodsType, { each: true })
  goodsType?: GoodsType[];

  @ApiProperty({ enum: ProductCategory, isArray: true, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return toStringArray(value);
  })
  @IsEnum(ProductCategory, { each: true })
  category?: ProductCategory[];

  @ApiProperty({ enum: MedicineGroup, isArray: true, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    return toStringArray(value);
  })
  @IsEnum(MedicineGroup, { each: true })
  group?: MedicineGroup[];

  @ApiProperty({ required: false })
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

const toStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',');
  return undefined;
};

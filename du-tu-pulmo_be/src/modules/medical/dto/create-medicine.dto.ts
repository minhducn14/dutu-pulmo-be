import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateMedicineDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  activeIngredient?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  content?: string;

  @ApiProperty({ enum: GoodsType, default: GoodsType.MEDICINE })
  @IsEnum(GoodsType)
  goodsType: GoodsType;

  @ApiPropertyOptional({ enum: ProductCategory, required: false })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({ enum: MedicineGroup, required: false })
  @IsOptional()
  @IsEnum(MedicineGroup)
  group?: MedicineGroup;

  @ApiPropertyOptional({ enum: RouteOfAdministration, required: false })
  @IsOptional()
  @IsEnum(RouteOfAdministration)
  route?: RouteOfAdministration;

  @ApiProperty({ enum: UnitOfMeasure })
  @IsEnum(UnitOfMeasure)
  unit: UnitOfMeasure;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  packing?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  manufacturer?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryOfOrigin?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  guide?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}

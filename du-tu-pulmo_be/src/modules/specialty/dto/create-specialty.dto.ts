import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateSpecialtyDto {
  @ApiProperty({ 
    example: 'Hô hấp', 
    description: 'Tên chuyên khoa' 
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ 
    example: 'Chuyên khoa về các bệnh lý đường hô hấp', 
    description: 'Mô tả chuyên khoa' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ 
    example: 'https://example.com/icon.png', 
    description: 'URL icon chuyên khoa' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string;

  @ApiPropertyOptional({ 
    example: 'https://example.com/image.jpg', 
    description: 'URL ảnh đại diện' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ 
    example: 1, 
    description: 'Thứ tự hiển thị' 
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ 
    example: true, 
    description: 'Trạng thái hoạt động' 
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ 
    example: null, 
    description: 'ID chuyên khoa cha (nếu là sub-specialty)' 
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateSubSpecialtyDto {
  @ApiProperty({ 
    example: 'COPD', 
    description: 'Tên chuyên khoa phụ' 
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ 
    example: 'Bệnh phổi tắc nghẽn mạn tính', 
    description: 'Mô tả chuyên khoa phụ' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ 
    example: 'https://example.com/icon.png', 
    description: 'URL icon' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string;

  @ApiPropertyOptional({ 
    example: 'uuid-specialty-id', 
    description: 'ID chuyên khoa cha' 
  })
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

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
}

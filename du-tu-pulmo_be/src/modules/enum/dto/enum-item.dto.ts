import { ApiProperty } from '@nestjs/swagger';

export class EnumItemDto {
  @ApiProperty({ example: '1' })
  code: string;

  @ApiProperty({ example: 'Việt Nam' })
  name: string;

  static fromEntry(entry: { code: string; name: string }): EnumItemDto {
    const dto = new EnumItemDto();
    dto.code = entry.code;
    dto.name = entry.name;
    return dto;
  }
}

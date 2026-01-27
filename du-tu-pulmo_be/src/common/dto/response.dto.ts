import { ApiProperty } from '@nestjs/swagger';

export class ResponseCommon<T = unknown> {
  constructor(code: number, message: string, data?: T) {
    this.code = code;
    this.message = message;
    this.data = data;
  }
  @ApiProperty({ example: 200, description: 'HTTP status code' })
  code: number;
  @ApiProperty({ example: 'Success' })
  message: string;
  @ApiProperty({ required: false })
  data?: T;
}

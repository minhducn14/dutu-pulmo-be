import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SystemService } from './system.service';

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}
}

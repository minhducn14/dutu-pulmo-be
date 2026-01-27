import { Controller, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';


@ApiTags('Reports')
@Controller('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

}

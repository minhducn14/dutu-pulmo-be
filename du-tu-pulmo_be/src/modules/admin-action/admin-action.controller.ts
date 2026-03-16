import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AdminActionService,
  AuditContext,
} from '@/modules/admin-action/admin-action.service';
import {
  CreateAdminActionDto,
  VoidAdminActionDto,
} from '@/modules/admin-action/dto/create-admin-action.dto';
import { AdminActionQueryDto } from '@/modules/admin-action/dto/update-admin-action.dto';
import { AdminActionResponseDto } from '@/modules/admin-action/dto/admin-action-response.dto';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { ResponseCommon } from '@/common/dto/response.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';

@ApiTags('Admin Actions (Audit Log)')
@Controller('admin-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth('JWT-auth')
export class AdminActionController {
  constructor(private readonly adminActionService: AdminActionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ghi nhận hành động admin (Audit log)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: AdminActionResponseDto,
    description: 'Tạo audit log thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ hoặc actionType không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Chỉ Admin có quyền',
  })
  async create(
    @Body() createAdminActionDto: CreateAdminActionDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ): Promise<ResponseCommon<AdminActionResponseDto>> {
    const context: AuditContext = {
      adminUserId: user.userId,
      adminAccountId: user.accountId,
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
    };

    const response = await this.adminActionService.create(
      createAdminActionDto,
      context,
    );

    return new ResponseCommon(
      response.code,
      response.message,
      AdminActionResponseDto.fromEntity(response.data!),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lấy lịch sử hành động admin (có phân trang)' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: AdminActionQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<AdminActionResponseDto>>> {
    const response = await this.adminActionService.findAll(query);
    const data = response.data ?? { items: [], total: 0, limit: 20, offset: 0 };
    const items = (data.items ?? []).map((action) =>
      AdminActionResponseDto.fromEntity(action),
    );
    const limit = data.limit || 20;
    const offset = data.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const paginated = new PaginatedResponseDto(items, data.total, page, limit);
    return new ResponseCommon(response.code, response.message, paginated);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hành động admin' })
  @ApiParam({ name: 'id', description: 'Admin Action ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminActionResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy admin action',
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<ResponseCommon<AdminActionResponseDto>> {
    const response = await this.adminActionService.findOne(id);
    return new ResponseCommon(
      response.code,
      response.message,
      AdminActionResponseDto.fromEntity(response.data!),
    );
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void hành động admin (thay vì xóa)' })
  @ApiParam({ name: 'id', description: 'Admin Action ID để void' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AdminActionResponseDto,
    description: 'Void thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy admin action hoặc đã được void',
  })
  async voidAction(
    @Param('id') id: string,
    @Body() dto: VoidAdminActionDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ): Promise<ResponseCommon<AdminActionResponseDto>> {
    const context: AuditContext = {
      adminUserId: user.userId,
      adminAccountId: user.accountId,
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
    };

    const response = await this.adminActionService.voidAction(id, dto, context);

    return new ResponseCommon(
      response.code,
      response.message,
      AdminActionResponseDto.fromEntity(response.data!),
    );
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
  }
}


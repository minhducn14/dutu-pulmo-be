import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  Post,
  Param,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AUTH_ERRORS } from 'src/common/constants/error-messages.constant';
import { AccountService } from './account.service';
import { AdminUpdateAccountDto } from './dto/update-account.dto';
import { AccountResponseDto } from './dto/account-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { RoleEnum } from '../common/enums/role.enum';

@ApiTags('Accounts')
@Controller('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tài khoản (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: [AccountResponseDto] })
  @Roles(RoleEnum.ADMIN)
  async findAll(): Promise<ResponseCommon<AccountResponseDto[]>> {
    const response = await this.accountService.findAll();
    const accounts = response.data ?? [];
    const data = accounts.map((acc) => AccountResponseDto.fromEntity(acc));
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy tài khoản theo id (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: AccountResponseDto })
  @ApiParam({ name: 'id', description: 'Account ID (UUID)' })
  @Roles(RoleEnum.ADMIN)
  async findOne(
    @Param('id') id: string,
  ): Promise<ResponseCommon<AccountResponseDto>> {
    const response = await this.accountService.findOne(id);
    const acc = response.data;
    if (!acc) {
      throw new NotFoundException(AUTH_ERRORS.ACCOUNT_NOT_FOUND);
    }
    return new ResponseCommon(
      response.code,
      response.message,
      AccountResponseDto.fromEntity(acc),
    );
  }

  @Patch(':id/admin')
  @ApiOperation({ summary: 'Cập nhật tài khoản (Admin only)' })
  @ApiParam({ name: 'id', description: 'Account ID to update' })
  @ApiResponse({ status: HttpStatus.OK, type: AccountResponseDto })
  @Roles(RoleEnum.ADMIN)
  async adminUpdate(
    @Param('id') id: string,
    @Body() dto: AdminUpdateAccountDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AccountResponseDto>> {
    const response = await this.accountService.adminUpdate(
      id,
      dto,
      user.accountId,
    );
    const acc = response.data;
    if (!acc) {
      throw new NotFoundException(AUTH_ERRORS.ACCOUNT_NOT_FOUND);
    }
    return new ResponseCommon(
      response.code,
      response.message,
      AccountResponseDto.fromEntity(acc),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa tài khoản (Admin - soft delete)' })
  @ApiParam({ name: 'id', description: 'Account ID to delete' })
  @ApiResponse({ status: HttpStatus.OK })
  @Roles(RoleEnum.ADMIN)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body('reason') reason?: string,
  ): Promise<ResponseCommon<null>> {
    return this.accountService.remove(id, user.accountId, reason);
  }

  @Get('admin/deleted')
  @ApiOperation({ summary: 'Xem tài khoản đã xóa (Admin)' })
  @ApiResponse({ status: HttpStatus.OK })
  @Roles(RoleEnum.ADMIN)
  async findDeleted(): Promise<ResponseCommon<AccountResponseDto[]>> {
    const response = await this.accountService.findDeleted();
    const accounts = response.data ?? [];
    const data = accounts.map((acc) => AccountResponseDto.fromEntity(acc));
    return new ResponseCommon(response.code, response.message, data);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Khôi phục tài khoản đã xóa (Admin)' })
  @ApiParam({ name: 'id', description: 'Account ID to restore' })
  @ApiResponse({ status: HttpStatus.OK, type: AccountResponseDto })
  @Roles(RoleEnum.ADMIN)
  async restore(
    @Param('id') id: string,
  ): Promise<ResponseCommon<AccountResponseDto | null>> {
    const response = await this.accountService.restore(id);
    const acc = response.data;
    if (!acc) {
      throw new NotFoundException(AUTH_ERRORS.ACCOUNT_NOT_FOUND);
    }
    return new ResponseCommon(
      response.code,
      response.message,
      AccountResponseDto.fromEntity(acc),
    );
  }
}

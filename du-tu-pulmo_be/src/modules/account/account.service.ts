import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Account } from './entities/account.entity';
import { AdminUpdateAccountDto } from './dto/update-account.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { RoleEnum } from '../common/enums/role.enum';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async findAll(): Promise<ResponseCommon<Account[]>> {
    const accounts = await this.accountRepo.find({ relations: ['user'] });
    return new ResponseCommon(200, 'SUCCESS', accounts);
  }

  async findOne(id: string): Promise<ResponseCommon<Account | null>> {
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', account);
  }

  async findByEmail(email: string): Promise<ResponseCommon<Account | null>> {
    const normalizedEmail = email.toLowerCase().trim();
    const account = await this.accountRepo.findOne({
      where: { email: normalizedEmail },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', account);
  }

  async adminUpdate(
    id: string,
    dto: AdminUpdateAccountDto,
    adminId: string,
  ): Promise<ResponseCommon<Account | null>> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    console.log(`Admin ${adminId} updating account ${id}:`, dto);

    if (dto.roles !== undefined) {
      account.roles = dto.roles as RoleEnum[];
    }
    if (dto.isVerified !== undefined) {
      account.isVerified = dto.isVerified;
    }

    await this.accountRepo.save(account);

    return new ResponseCommon(200, 'SUCCESS', account);
  }

  async remove(
    id: string,
    deletedBy: string,
    reason?: string,
  ): Promise<ResponseCommon<null>> {
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    account.deletedBy = deletedBy;
    account.deleteReason = reason || 'Account deleted by user request';
    await this.accountRepo.save(account);

    // Use TypeORM soft delete (sets deletedAt)
    await this.accountRepo.softDelete(id);

    return new ResponseCommon(200, 'SUCCESS', null);
  }

  /**
   * Admin only: Hard delete (for data cleanup during development only)
   */
  async hardDelete(id: string): Promise<ResponseCommon<null>> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Hard delete not allowed in production');
    }

    await this.accountRepo.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }

  /**
   * Find deleted accounts (for admin recovery)
   */
  async findDeleted(): Promise<ResponseCommon<Account[]>> {
    const accounts = await this.accountRepo.find({
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true,
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', accounts);
  }

  /**
   * Restore soft-deleted account
   */
  async restore(id: string): Promise<ResponseCommon<Account | null>> {
    await this.accountRepo.restore(id);
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', account);
  }
}

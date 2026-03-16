import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  AdminAction,
  AdminActionType,
} from '@/modules/admin-action/entities/admin-action.entity';
import {
  CreateAdminActionDto,
  VoidAdminActionDto,
} from '@/modules/admin-action/dto/create-admin-action.dto';
import { AdminActionQueryDto } from '@/modules/admin-action/dto/update-admin-action.dto';
import { ResponseCommon } from '@/common/dto/response.dto';

/**
 * Actor context passed from controller
 */
export interface AuditContext {
  adminUserId: string;
  adminAccountId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AdminActionService {
  constructor(
    @InjectRepository(AdminAction)
    private adminActionRepository: Repository<AdminAction>,
  ) {}

  async create(
    dto: CreateAdminActionDto,
    context: AuditContext,
  ): Promise<ResponseCommon<AdminAction>> {
    const action = this.adminActionRepository.create({
      adminUserId: context.adminUserId,
      adminAccountId: context.adminAccountId,
      targetUserId: dto.targetUserId,
      actionType: dto.actionType,
      description: dto.description,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      metadata: dto.metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    const saved = await this.adminActionRepository.save(action);
    return new ResponseCommon(201, 'SUCCESS', saved);
  }

  async findAll(query: AdminActionQueryDto): Promise<
    ResponseCommon<{
      items: AdminAction[];
      total: number;
      limit: number;
      offset: number;
    }>
  > {
    const limit = Math.min(query.limit || 20, 100);
    const offset = query.offset || 0;

    // Build where conditions
    const where: FindOptionsWhere<AdminAction> = {};

    if (query.actionType) {
      where.actionType = query.actionType;
    }
    if (query.adminUserId) {
      where.adminUserId = query.adminUserId;
    }
    if (query.targetUserId) {
      where.targetUserId = query.targetUserId;
    }
    if (!query.includeVoided) {
      where.isVoided = false;
    }

    // Build query with date filters
    const qb = this.adminActionRepository.createQueryBuilder('action');

    if (query.actionType) {
      qb.andWhere('action.action_type = :actionType', {
        actionType: query.actionType,
      });
    }
    if (query.adminUserId) {
      qb.andWhere('action.admin_user_id = :adminUserId', {
        adminUserId: query.adminUserId,
      });
    }
    if (query.targetUserId) {
      qb.andWhere('action.target_user_id = :targetUserId', {
        targetUserId: query.targetUserId,
      });
    }
    if (!query.includeVoided) {
      qb.andWhere('action.is_voided = false');
    }
    if (query.fromDate) {
      qb.andWhere('action.created_at >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('action.created_at <= :toDate', { toDate: query.toDate });
    }

    qb.orderBy('action.created_at', 'DESC').skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return new ResponseCommon(200, 'SUCCESS', {
      items,
      total,
      limit,
      offset,
    });
  }

  async findOne(id: string): Promise<ResponseCommon<AdminAction>> {
    const action = await this.adminActionRepository.findOne({
      where: { id },
    });

    if (!action) {
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    return new ResponseCommon(200, 'SUCCESS', action);
  }

  async voidAction(
    id: string,
    dto: VoidAdminActionDto,
    context: AuditContext,
  ): Promise<ResponseCommon<AdminAction>> {
    const original = await this.adminActionRepository.findOne({
      where: { id },
    });

    if (!original) {
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (original.isVoided) {
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    // Mark original as voided
    original.isVoided = true;
    original.voidedAt = new Date();
    original.voidedByUserId = context.adminUserId;
    original.voidReason = dto.reason;
    await this.adminActionRepository.save(original);

    // Create a VOID action record for audit trail
    const voidAction = this.adminActionRepository.create({
      adminUserId: context.adminUserId,
      adminAccountId: context.adminAccountId,
      actionType: AdminActionType.VOID_ACTION,
      description: `Voided action ${id}: ${dto.reason}`,
      voidsActionId: id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      metadata: {
        voidedActionType: original.actionType,
        voidedActionTarget: original.targetUserId,
        reason: dto.reason,
      },
    });
    await this.adminActionRepository.save(voidAction);

    return new ResponseCommon(200, 'SUCCESS', original);
  }
}


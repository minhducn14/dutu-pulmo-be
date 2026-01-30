import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAction } from './entities/admin-action.entity';

@Injectable()
export class AdminActionService {
  constructor(
    @InjectRepository(AdminAction)
    private adminActionRepository: Repository<AdminAction>,
  ) {}
}

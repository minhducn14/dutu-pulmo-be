import { Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '@/modules/medical/entities/medicine.entity';
import { CreateMedicineDto } from '@/modules/medical/dto/create-medicine.dto';
import { FilterMedicineQueryDto } from '@/modules/medical/dto/filter-medicine.dto';
import { UpdateMedicineDto } from '@/modules/medical/dto/update-medicine.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { applyPaginationAndSort } from '@/common/utils/pagination.util';

@Injectable()
export class MedicineService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,
  ) {}

  async create(
    createMedicineDto: CreateMedicineDto,
  ): Promise<ResponseCommon<Medicine>> {
    const medicine = this.medicineRepository.create(createMedicineDto);
    const result = await this.medicineRepository.save(medicine);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Tạo thuốc thành công',
      result,
    );
  }

  async findAll(
    filterDto: FilterMedicineQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<Medicine>>> {
    const queryBuilder = this.medicineRepository.createQueryBuilder('medicine');

    if (filterDto.name) {
      queryBuilder.andWhere('medicine.name ILIKE :name', {
        name: `%${filterDto.name}%`,
      });
    }

    if (filterDto.goodsType && filterDto.goodsType.length > 0) {
      queryBuilder.andWhere('medicine.goodsType IN (:...goodsType)', {
        goodsType: filterDto.goodsType,
      });
    }

    if (filterDto.category && filterDto.category.length > 0) {
      queryBuilder.andWhere('medicine.category IN (:...category)', {
        category: filterDto.category,
      });
    }

    if (filterDto.group && filterDto.group.length > 0) {
      queryBuilder.andWhere('medicine.group IN (:...group)', {
        group: filterDto.group,
      });
    }

    if (filterDto.isActive !== undefined) {
      queryBuilder.andWhere('medicine.status = :isActive', {
        isActive: filterDto.isActive,
      });
    }

    if (filterDto.search) {
      queryBuilder.andWhere('medicine.name ILIKE :search', {
        search: `%${filterDto.search}%`,
      });
    }

    applyPaginationAndSort(
      queryBuilder,
      filterDto,
      ['createdAt', 'name', 'price', 'quantity', 'group', 'category'],
      'createdAt',
      'DESC',
    );

    const [entities, itemCount] = await queryBuilder.getManyAndCount();
    const limit = filterDto.limit || 10;
    const page = filterDto.page || 1;

    const responseData = new PaginatedResponseDto(
      entities,
      itemCount,
      page,
      limit,
    );

    return new ResponseCommon(HttpStatus.OK, 'Thành công', responseData);
  }

  async findOne(id: string): Promise<ResponseCommon<Medicine>> {
    const medicine = await this.medicineRepository.findOne({ where: { id } });
    if (!medicine) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICINE_NOT_FOUND);
    }
    return new ResponseCommon(HttpStatus.OK, 'Thành công', medicine);
  }

  async update(
    id: string,
    updateMedicineDto: UpdateMedicineDto,
  ): Promise<ResponseCommon<Medicine>> {
    const response = await this.findOne(id);
    const medicine = response.data;
    if (!medicine)
      throw new NotFoundException(ERROR_MESSAGES.MEDICINE_NOT_FOUND);

    Object.assign(medicine, updateMedicineDto);
    const result = await this.medicineRepository.save(medicine);
    return new ResponseCommon(HttpStatus.OK, 'Cập nhật thành công', result);
  }

  async remove(id: string): Promise<ResponseCommon<boolean>> {
    const response = await this.findOne(id);
    const medicine = response.data;
    if (!medicine)
      throw new NotFoundException(ERROR_MESSAGES.MEDICINE_NOT_FOUND);

    medicine.status = false;
    await this.medicineRepository.save(medicine);
    return new ResponseCommon(HttpStatus.OK, 'Xóa thành công', true);
  }
}


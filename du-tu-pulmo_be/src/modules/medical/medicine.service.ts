import { Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '@/modules/medical/entities/medicine.entity';
import { CreateMedicineDto } from '@/modules/medical/dto/create-medicine.dto';
import { FilterMedicineDto } from '@/modules/medical/dto/filter-medicine.dto';
import { UpdateMedicineDto } from '@/modules/medical/dto/update-medicine.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { MEDICAL_ERRORS } from '@/common/constants/error-messages.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';

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
    filterDto: FilterMedicineDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<Medicine>>> {
    const queryBuilder = this.medicineRepository.createQueryBuilder('medicine');
    const page = filterDto.page || 1;
    const limit = filterDto.limit || 10;

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

    queryBuilder
      .orderBy('medicine.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const itemCount = await queryBuilder.getCount();
    const { entities } = await queryBuilder.getRawAndEntities();
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
      throw new NotFoundException(MEDICAL_ERRORS.MEDICINE_NOT_FOUND);
    }
    return new ResponseCommon(HttpStatus.OK, 'Thành công', medicine);
  }

  async update(
    id: string,
    updateMedicineDto: UpdateMedicineDto,
  ): Promise<ResponseCommon<Medicine>> {
    const response = await this.findOne(id);
    const medicine = response.data;
    if (!medicine) throw new NotFoundException(MEDICAL_ERRORS.MEDICINE_NOT_FOUND);

    Object.assign(medicine, updateMedicineDto);
    const result = await this.medicineRepository.save(medicine);
    return new ResponseCommon(HttpStatus.OK, 'Cập nhật thành công', result);
  }

  async remove(id: string): Promise<ResponseCommon<boolean>> {
    const response = await this.findOne(id);
    const medicine = response.data;
    if (!medicine) throw new NotFoundException(MEDICAL_ERRORS.MEDICINE_NOT_FOUND);

    medicine.status = false;
    await this.medicineRepository.save(medicine);
    return new ResponseCommon(HttpStatus.OK, 'Xóa thành công', true);
  }
}

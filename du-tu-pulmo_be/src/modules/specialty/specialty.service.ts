import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialty } from './entities/specialty.entity';
import { SubSpecialty } from './entities/sub-specialty.entity';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
import { CreateSubSpecialtyDto } from './dto/create-sub-specialty.dto';
import { UpdateSubSpecialtyDto } from './dto/update-sub-specialty.dto';

@Injectable()
export class SpecialtyService {
  constructor(
    @InjectRepository(Specialty)
    private readonly specialtyRepo: Repository<Specialty>,
    @InjectRepository(SubSpecialty)
    private readonly subSpecialtyRepo: Repository<SubSpecialty>,
  ) {}

  // ========== Specialty Methods ==========

  async findAllSpecialties(): Promise<ResponseCommon<Specialty[]>> {
    const specialties = await this.specialtyRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', specialties);
  }

  async findOneSpecialty(id: string): Promise<ResponseCommon<Specialty | null>> {
    const specialty = await this.specialtyRepo.findOne({
      where: { id },
    });
    return new ResponseCommon(200, 'SUCCESS', specialty);
  }

  async createSpecialty(dto: CreateSpecialtyDto): Promise<ResponseCommon<Specialty>> {
    const existing = await this.specialtyRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Chuyên khoa "${dto.name}" đã tồn tại`);
    }
    const specialty = this.specialtyRepo.create(dto);
    await this.specialtyRepo.save(specialty);
    return new ResponseCommon(201, 'Tạo chuyên khoa thành công', specialty);
  }

  async updateSpecialty(id: string, dto: UpdateSpecialtyDto): Promise<ResponseCommon<Specialty | null>> {
    const specialty = await this.specialtyRepo.findOne({ where: { id } });
    if (!specialty) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa với ID ${id}`);
    }
    if (dto.name && dto.name !== specialty.name) {
      const existing = await this.specialtyRepo.findOne({ where: { name: dto.name } });
      if (existing) {
        throw new ConflictException(`Chuyên khoa "${dto.name}" đã tồn tại`);
      }
    }
    Object.assign(specialty, dto);
    await this.specialtyRepo.save(specialty);
    return new ResponseCommon(200, 'Cập nhật thành công', specialty);
  }

  async removeSpecialty(id: string): Promise<ResponseCommon<null>> {
    const specialty = await this.specialtyRepo.findOne({ where: { id } });
    if (!specialty) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa với ID ${id}`);
    }
    await this.specialtyRepo.softDelete(id);
    return new ResponseCommon(200, 'Xóa chuyên khoa thành công', null);
  }

  async restoreSpecialty(id: string): Promise<ResponseCommon<Specialty | null>> {
    await this.specialtyRepo.restore(id);
    const specialty = await this.specialtyRepo.findOne({ where: { id } });
    return new ResponseCommon(200, 'Khôi phục thành công', specialty);
  }

  // ========== SubSpecialty Methods ==========

  async findAllSubSpecialties(): Promise<ResponseCommon<SubSpecialty[]>> {
    const subSpecialties = await this.subSpecialtyRepo.find({
      where: { isActive: true },
      relations: ['specialty'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', subSpecialties);
  }

  async findSubSpecialtiesBySpecialtyId(specialtyId: string): Promise<ResponseCommon<SubSpecialty[]>> {
    const subSpecialties = await this.subSpecialtyRepo.find({
      where: { specialtyId, isActive: true },
      relations: ['specialty'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', subSpecialties);
  }

  async findOneSubSpecialty(id: string): Promise<ResponseCommon<SubSpecialty | null>> {
    const subSpecialty = await this.subSpecialtyRepo.findOne({
      where: { id },
      relations: ['specialty'],
    });
    return new ResponseCommon(200, 'SUCCESS', subSpecialty);
  }

  async createSubSpecialty(dto: CreateSubSpecialtyDto): Promise<ResponseCommon<SubSpecialty>> {
    if (dto.specialtyId) {
      const specialty = await this.specialtyRepo.findOne({ where: { id: dto.specialtyId } });
      if (!specialty) {
        throw new NotFoundException(`Không tìm thấy chuyên khoa cha với ID ${dto.specialtyId}`);
      }
    }

    const subSpecialty = this.subSpecialtyRepo.create(dto);
    await this.subSpecialtyRepo.save(subSpecialty);
    return new ResponseCommon(201, 'Tạo chuyên khoa phụ thành công', subSpecialty);
  }

  async updateSubSpecialty(id: string, dto: UpdateSubSpecialtyDto): Promise<ResponseCommon<SubSpecialty | null>> {
    const subSpecialty = await this.subSpecialtyRepo.findOne({ where: { id } });
    if (!subSpecialty) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa phụ với ID ${id}`);
    }

    if (dto.specialtyId && dto.specialtyId !== subSpecialty.specialtyId) {
      const specialty = await this.specialtyRepo.findOne({ where: { id: dto.specialtyId } });
      if (!specialty) {
        throw new NotFoundException(`Không tìm thấy chuyên khoa cha với ID ${dto.specialtyId}`);
      }
    }

    Object.assign(subSpecialty, dto);
    await this.subSpecialtyRepo.save(subSpecialty);
    return new ResponseCommon(200, 'Cập nhật thành công', subSpecialty);
  }

  async removeSubSpecialty(id: string): Promise<ResponseCommon<null>> {
    const subSpecialty = await this.subSpecialtyRepo.findOne({ where: { id } });
    if (!subSpecialty) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa phụ với ID ${id}`);
    }
    await this.subSpecialtyRepo.softDelete(id);
    return new ResponseCommon(200, 'Xóa chuyên khoa phụ thành công', null);
  }

  async restoreSubSpecialty(id: string): Promise<ResponseCommon<SubSpecialty | null>> {
    await this.subSpecialtyRepo.restore(id);
    const subSpecialty = await this.subSpecialtyRepo.findOne({
      where: { id },
      relations: ['specialty'],
    });
    return new ResponseCommon(200, 'Khôi phục thành công', subSpecialty);
  }
}


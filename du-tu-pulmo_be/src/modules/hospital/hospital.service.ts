import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital } from './entities/hospital.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import {
  CreateHospitalDto,
  UpdateHospitalDto,
  HospitalQueryDto,
} from './dto/hospital.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class HospitalService {
  constructor(
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

  /**
   * Lấy danh sách hospitals với pagination và search
   */
  async findAll(query: HospitalQueryDto): Promise<
    ResponseCommon<{
      data: Hospital[];
      total: number;
      page: number;
      limit: number;
    }>
  > {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    const queryBuilder = this.hospitalRepository
      .createQueryBuilder('hospital')
      .where('hospital.deletedAt IS NULL');

    // Search by name, hospitalCode, address, province, or ward
    if (query.search) {
      queryBuilder.andWhere(
        '(hospital.name ILIKE :search OR hospital.hospitalCode ILIKE :search OR hospital.address ILIKE :search OR hospital.province ILIKE :search OR hospital.ward ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Filter by facilityType
    if (query.facilityType) {
      queryBuilder.andWhere('hospital.facilityType = :facilityType', {
        facilityType: query.facilityType,
      });
    }

    // Filter by provinceCode
    if (query.provinceCode) {
      queryBuilder.andWhere('hospital.provinceCode = :provinceCode', {
        provinceCode: query.provinceCode,
      });
    }

    // Filter by province name (exact match)
    if (query.province) {
      queryBuilder.andWhere('hospital.province ILIKE :province', {
        province: `%${query.province}%`,
      });
    }

    // Filter by wardCode
    if (query.wardCode) {
      queryBuilder.andWhere('hospital.wardCode = :wardCode', {
        wardCode: query.wardCode,
      });
    }

    // Filter by ward name (exact match)
    if (query.ward) {
      queryBuilder.andWhere('hospital.ward ILIKE :ward', {
        ward: `%${query.ward}%`,
      });
    }

    const [data, total] = await queryBuilder
      .orderBy('hospital.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new ResponseCommon(200, 'SUCCESS', {
      data,
      total,
      page,
      limit,
    });
  }

  /**
   * Lấy thông tin hospital theo ID
   */
  async findById(id: string): Promise<ResponseCommon<Hospital>> {
    const hospital = await this.hospitalRepository.findOne({
      where: { id },
    });

    if (!hospital) {
      throw new NotFoundException(`Không tìm thấy bệnh viện với ID ${id}`);
    }

    return new ResponseCommon(200, 'SUCCESS', hospital);
  }

  /**
   * Lấy hospital theo hospitalCode
   */
  async findByCode(hospitalCode: string): Promise<ResponseCommon<Hospital>> {
    const hospital = await this.hospitalRepository.findOne({
      where: { hospitalCode },
    });

    if (!hospital) {
      throw new NotFoundException(
        `Không tìm thấy bệnh viện với mã ${hospitalCode}`,
      );
    }

    return new ResponseCommon(200, 'SUCCESS', hospital);
  }

  /**
   * Kiểm tra hospitalCode đã tồn tại chưa
   */
  private async checkHospitalCodeExists(
    hospitalCode: string,
    excludeId?: string,
  ): Promise<void> {
    const queryBuilder = this.hospitalRepository
      .createQueryBuilder('hospital')
      .where('hospital.hospitalCode = :hospitalCode', { hospitalCode });

    if (excludeId) {
      queryBuilder.andWhere('hospital.id != :excludeId', { excludeId });
    }

    const existing = await queryBuilder.getOne();

    if (existing) {
      throw new ConflictException(`Mã bệnh viện ${hospitalCode} đã tồn tại`);
    }
  }

  /**
   * Validate coordinates
   */
  private validateCoordinates(latitude?: number, longitude?: number): void {
    if (
      (latitude !== undefined && longitude === undefined) ||
      (latitude === undefined && longitude !== undefined)
    ) {
      throw new BadRequestException(
        'Vĩ độ và kinh độ phải được cung cấp cùng nhau',
      );
    }

    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      throw new BadRequestException('Vĩ độ phải trong khoảng -90 đến 90');
    }

    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      throw new BadRequestException('Kinh độ phải trong khoảng -180 đến 180');
    }
  }

  /**
   * Tạo hospital mới
   */
  async create(dto: CreateHospitalDto): Promise<ResponseCommon<Hospital>> {
    // Check duplicate hospitalCode
    await this.checkHospitalCodeExists(dto.hospitalCode);

    // Validate coordinates
    this.validateCoordinates(dto.latitude, dto.longitude);

    const hospital = this.hospitalRepository.create(dto);
    const saved = await this.hospitalRepository.save(hospital);

    return new ResponseCommon(201, 'Tạo bệnh viện thành công', saved);
  }

  /**
   * Cập nhật hospital
   */
  async update(
    id: string,
    dto: UpdateHospitalDto,
  ): Promise<ResponseCommon<Hospital>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    // Check hospitalCode if changed
    if (dto.hospitalCode && dto.hospitalCode !== existing.hospitalCode) {
      await this.checkHospitalCodeExists(dto.hospitalCode, id);
    }

    // Validate coordinates if provided
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const newLat =
        dto.latitude !== undefined ? dto.latitude : existing.latitude;
      const newLng =
        dto.longitude !== undefined ? dto.longitude : existing.longitude;
      this.validateCoordinates(newLat, newLng);
    }

    await this.hospitalRepository.update(id, dto);
    const updated = await this.hospitalRepository.findOne({ where: { id } });

    return new ResponseCommon(200, 'Cập nhật bệnh viện thành công', updated!);
  }

  /**
   * Soft delete hospital
   */
  async delete(id: string): Promise<ResponseCommon<null>> {
    await this.findById(id);

    await this.hospitalRepository.softDelete(id);
    return new ResponseCommon(200, 'Xóa bệnh viện thành công', null);
  }

  /**
   * Restore soft deleted hospital (Admin only)
   */
  async restore(id: string): Promise<ResponseCommon<Hospital>> {
    const hospital = await this.hospitalRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!hospital) {
      throw new NotFoundException(`Không tìm thấy bệnh viện với ID ${id}`);
    }

    if (!hospital.deletedAt) {
      throw new BadRequestException('Bệnh viện chưa bị xóa');
    }

    await this.hospitalRepository.restore(id);
    const restored = await this.hospitalRepository.findOne({ where: { id } });

    return new ResponseCommon(200, 'Khôi phục bệnh viện thành công', restored!);
  }

  /**
   * Lấy danh sách facility types (dùng cho filter)
   */
  async getFacilityTypes(): Promise<ResponseCommon<string[]>> {
    const types = await this.hospitalRepository
      .createQueryBuilder('hospital')
      .select('DISTINCT hospital.facilityType', 'facilityType')
      .where('hospital.deletedAt IS NULL')
      .orderBy('hospital.facilityType', 'ASC')
      .getRawMany();

    return new ResponseCommon(
      200,
      'SUCCESS',
      types.map((t) => t.facilityType).filter(Boolean),
    );
  }

  /**
   * Lấy danh sách provinces (dùng cho filter)
   */
  async getProvinces(): Promise<
    ResponseCommon<{ provinceCode: string; province: string }[]>
  > {
    const provinces = await this.hospitalRepository
      .createQueryBuilder('hospital')
      .select('DISTINCT hospital.provinceCode', 'provinceCode')
      .addSelect('hospital.province', 'province')
      .where('hospital.deletedAt IS NULL')
      .andWhere('hospital.provinceCode IS NOT NULL')
      .orderBy('hospital.province', 'ASC')
      .getRawMany();

    return new ResponseCommon(200, 'SUCCESS', provinces);
  }

  /**
   * Lấy danh sách bác sĩ theo hospital ID
   */
  async getDoctorsByHospitalId(
    hospitalId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ResponseCommon<PaginatedResponseDto<Doctor>>> {
    // Verify hospital exists
    await this.findById(hospitalId);

    const skip = (page - 1) * limit;
    const [items, totalItems] = await this.doctorRepository.findAndCount({
      where: { primaryHospitalId: hospitalId },
      relations: ['user'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const paginatedData = new PaginatedResponseDto(
      items,
      totalItems,
      page,
      limit,
    );
    return new ResponseCommon(200, 'SUCCESS', paginatedData);
  }
}

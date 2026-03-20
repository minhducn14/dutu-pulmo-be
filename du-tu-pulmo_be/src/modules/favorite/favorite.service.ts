import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '@/modules/favorite/entities/favorite.entity';
import { CreateFavoriteDto } from '@/modules/favorite/dto/create-favorite.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Hospital } from '@/modules/hospital/entities/hospital.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Hospital)
    private hospitalRepository: Repository<Hospital>,
  ) {}

  async create(
    createFavoriteDto: CreateFavoriteDto,
    userId: string,
  ): Promise<ResponseCommon<Favorite>> {
    const { doctorId, hospitalId } = createFavoriteDto;

    // Validate: phải có ít nhất 1 trong 2
    if (!doctorId && !hospitalId) {
      throw new BadRequestException(
        ERROR_MESSAGES.MISSING_DOCTOR_OR_HOSPITAL_ID,
      );
    }

    // Check duplicate
    const duplicate = await this.favoriteRepository.findOne({
      where: {
        userId,
        ...(doctorId && { doctorId }),
        ...(hospitalId && { hospitalId }),
      },
    });

    if (duplicate) {
      return new ResponseCommon(
        200,
        'Đã có trong danh sách yêu thích',
        duplicate,
      );
    }

    const favorite = this.favoriteRepository.create({
      userId,
      doctorId,
      hospitalId,
    });

    const saved = await this.favoriteRepository.save(favorite);

    // Re-fetch with relations to return full data
    const fullFavorite = await this.favoriteRepository.findOne({
      where: { id: saved.id },
      relations: ['doctor', 'doctor.user', 'doctor.user.account', 'hospital'],
    });

    return new ResponseCommon(
      201,
      'Thêm vào yêu thích thành công',
      fullFavorite!,
    );
  }

  async findAll(userId: string): Promise<ResponseCommon<Favorite[]>> {
    const favorites = await this.favoriteRepository.find({
      where: { userId },
      relations: ['doctor', 'doctor.user', 'doctor.user.account', 'hospital'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', favorites);
  }

  async findOne(id: string): Promise<ResponseCommon<Favorite | null>> {
    const favorite = await this.favoriteRepository.findOne({
      where: { id },
      relations: [
        'user',
        'doctor',
        'doctor.user',
        'doctor.user.account',
        'hospital',
      ],
    });
    return new ResponseCommon(200, 'SUCCESS', favorite);
  }

  async remove(id: string, userId: string): Promise<ResponseCommon<null>> {
    // Tìm favorite theo doctorId hoặc hospitalId
    const favoriteByDoctor = await this.favoriteRepository.findOne({
      where: { userId, doctorId: id },
    });

    const favoriteByHospital = await this.favoriteRepository.findOne({
      where: { userId, hospitalId: id },
    });

    const favoriteById = await this.favoriteRepository.findOne({
      where: { id, userId },
    });

    const toDelete = favoriteByDoctor || favoriteByHospital || favoriteById;

    if (!toDelete) {
      throw new NotFoundException(ERROR_MESSAGES.FAVORITE_NOT_FOUND);
    }

    await this.favoriteRepository.delete(toDelete.id);
    return new ResponseCommon(200, 'Xóa khỏi yêu thích thành công', null);
  }

  async findByDoctor(
    userId: string,
    doctorId: string,
  ): Promise<ResponseCommon<Favorite | null>> {
    const favorite = await this.favoriteRepository.findOne({
      where: { userId, doctorId },
      relations: ['doctor', 'doctor.user', 'doctor.user.account'],
    });
    return new ResponseCommon(200, 'SUCCESS', favorite);
  }

  async findByHospital(
    userId: string,
    hospitalId: string,
  ): Promise<ResponseCommon<Favorite | null>> {
    const favorite = await this.favoriteRepository.findOne({
      where: { userId, hospitalId },
      relations: ['hospital'],
    });
    return new ResponseCommon(200, 'SUCCESS', favorite);
  }
}

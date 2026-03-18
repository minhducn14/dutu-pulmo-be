import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from '@/modules/favorite/entities/favorite.entity';
import { FavoriteService } from '@/modules/favorite/favorite.service';
import { FavoriteController } from '@/modules/favorite/favorite.controller';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Hospital } from '@/modules/hospital/entities/hospital.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Doctor, Hospital])],
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService, TypeOrmModule],
})
export class FavoriteModule {}

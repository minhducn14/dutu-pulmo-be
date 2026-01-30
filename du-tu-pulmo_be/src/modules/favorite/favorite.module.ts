import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from '@/modules/favorite/entities/favorite.entity';
import { FavoriteService } from '@/modules/favorite/favorite.service';
import { FavoriteController } from '@/modules/favorite/favorite.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite])],
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService, TypeOrmModule],
})
export class FavoriteModule {}

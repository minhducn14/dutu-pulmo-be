import { Controller, UseGuards } from '@nestjs/common';
import { FavoriteService } from '@/modules/favorite/favorite.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';

@ApiTags('Favorites')
@Controller('favorites')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}
}

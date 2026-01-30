import { Module } from '@nestjs/common';
import { CloudinaryService } from '@/modules/cloudinary/cloudinary.service';
import { CloudinaryController } from '@/modules/cloudinary/cloudinary.controller';

@Module({
  providers: [CloudinaryService],
  controllers: [CloudinaryController],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}

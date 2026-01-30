import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CloudinaryService } from '@/modules/cloudinary/cloudinary.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import {
  fileTypeConfigs,
  FileDefaults,
} from '@/common/config/file-type.config';
import { ResponseCommon } from '@/common/dto/response.dto';
import { CloudinaryUploadResponseDto } from '@/modules/cloudinary/dto/cloudinary-upload-response.dto';

@ApiTags('Upload')
@Controller('upload')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: fileTypeConfigs.image.maxSize },
      fileFilter: (req, file, callback) => {
        if (!fileTypeConfigs.image.allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only image files are allowed (jpg, jpeg, png, gif, webp)',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Folder to store the image (default: images)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ): Promise<ResponseCommon<CloudinaryUploadResponseDto>> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const result = await this.cloudinaryService.uploadImage(file, folder);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'SUCCESS',
      CloudinaryUploadResponseDto.fromEntity(result),
    );
  }

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FilesInterceptor('files', FileDefaults.MAX_LICENSE_IMAGES, {
      limits: { fileSize: fileTypeConfigs.image.maxSize },
      fileFilter: (req, file, callback) => {
        if (!fileTypeConfigs.image.allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only image files are allowed (jpg, jpeg, png, gif, webp)',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload multiple images (max 5)' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Folder to store the images (default: images)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder?: string,
  ): Promise<ResponseCommon<CloudinaryUploadResponseDto[]>> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    const results = await this.cloudinaryService.uploadImages(files, folder);
    const data = (results ?? []).map((result) =>
      CloudinaryUploadResponseDto.fromEntity(result),
    );
    return new ResponseCommon(HttpStatus.CREATED, 'SUCCESS', data);
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: FileDefaults.MAX_AVATAR_SIZE },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException(
              'Only image files are allowed (jpg, jpeg, png, webp)',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<CloudinaryUploadResponseDto>> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const result = await this.cloudinaryService.uploadAvatar(file, user.userId);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'SUCCESS',
      CloudinaryUploadResponseDto.fromEntity(result),
    );
  }

  @Delete(':publicId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete an image by public ID' })
  async deleteImage(
    @Param('publicId') publicId: string,
  ): Promise<ResponseCommon<{ result: string }>> {
    const result = await this.cloudinaryService.deleteImage(publicId);
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', result);
  }
}

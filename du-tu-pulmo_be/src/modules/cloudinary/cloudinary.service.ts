import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Upload medical X-ray image WITHOUT transformation
   * Preserves original quality and resolution for diagnosis
   */
  async uploadMedicalImage(
    file: Express.Multer.File,
    screeningId: string,
    imageType: 'original' | 'annotated' | 'evaluated' = 'original',
  ): Promise<CloudinaryUploadResult> {
    const timestamp = Date.now();
    const filename = `${screeningId}-${imageType}-${timestamp}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `medical_images/${imageType}`,
          allowed_formats: ['jpg', 'png', 'jpeg', 'dcm', 'dicom'],
          // IMPORTANT: No transformation - preserve original quality
          resource_type: 'image',
          unique_filename: true,
          public_id: filename,
          // Keep original dimensions and quality
          quality: 100,
          flags: 'preserve_transparency',
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(
              new BadRequestException(
                `Medical image upload failed: ${error.message}`,
              ),
            );
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          } else {
            reject(
              new BadRequestException(
                'Medical image upload failed: Unknown error',
              ),
            );
          }
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  /**
   * Upload a single image to Cloudinary (for general use, not medical)
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'images',
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' },
          ],
          unique_filename: true,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(new BadRequestException(`Upload failed: ${error.message}`));
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          } else {
            reject(new BadRequestException('Upload failed: Unknown error'));
          }
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  /**
   * Upload multiple images to Cloudinary
   */
  async uploadImages(
    files: Express.Multer.File[],
    folder: string = 'images',
  ): Promise<CloudinaryUploadResult[]> {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Upload avatar image with specific transformations
   */
  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<CloudinaryUploadResult> {
    const filename = `avatar-${userId}-${this.formatDate(Date.now())}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          transformation: [
            // { width: 400, height: 400, crop: 'fill' },
            { quality: 'auto' },
          ],
          overwrite: true,
          unique_filename: true,
          public_id: filename,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(new BadRequestException(`Upload failed: ${error.message}`));
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
            });
          } else {
            reject(new BadRequestException('Upload failed: Unknown error'));
          }
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  /**
   * Delete an image from Cloudinary by public ID
   */
  async deleteImage(publicId: string): Promise<{ result: string }> {
    try {
      const result = (await cloudinary.uploader.destroy(publicId)) as {
        result: string;
      };
      return result;
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete multiple images from Cloudinary
   */
  async deleteImages(publicIds: string[]): Promise<void> {
    try {
      await cloudinary.api.delete_resources(publicIds);
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete images: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate a thumbnail URL from existing Cloudinary image
   * Uses Cloudinary's on-the-fly transformation (no upload needed)
   */
  getThumbnailUrl(
    publicId: string,
    width: number = 200,
    height: number = 200,
  ): string {
    return cloudinary.url(publicId, {
      transformation: [
        { width, height, crop: 'fill' },
        { quality: 'auto' },
        { fetch_format: 'auto' },
      ],
      secure: true,
    });
  }

  /**
   * Get optimized image URL with custom transformations
   */
  getImageUrl(
    publicId: string,
    options?: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      format?: string;
    },
  ): string {
    const transformation: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      fetch_format?: string;
    } = {};

    if (options?.width) transformation.width = options.width;
    if (options?.height) transformation.height = options.height;
    if (options?.crop) transformation.crop = options.crop;
    if (options?.quality) transformation.quality = options.quality;
    if (options?.format) transformation.fetch_format = options.format;

    return cloudinary.url(publicId, {
      transformation: [transformation],
      secure: true,
    });
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hour}${minute}${second}`;
  }
}

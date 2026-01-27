import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  // Allowed MIME types for medical images
  private readonly allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/dicom',
    'application/dicom',
    'application/octet-stream',
  ];

  private readonly maxDicomSize = 50 * 1024 * 1024; // 50MB
  private readonly maxImageSize = 10 * 1024 * 1024; // 10MB

  // Magic bytes for file type detection
  private readonly magicBytes: Record<string, number[]> = {
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'application/dicom': [0x44, 0x49, 0x43, 0x4d], // DICM at offset 128
  };

  /**
   * Validate file before processing
   */
  validateFile(
    buffer: Buffer,
    originalName: string,
    declaredMimeType: string,
  ): {
    isValid: boolean;
    mimeType: string;
    checksum: string;
    errors: string[];
  } {
    const errors: string[] = [];
    let detectedMimeType = declaredMimeType;

    // 1. Check file size
    const maxSize = this.isDicomFile(declaredMimeType, buffer)
      ? this.maxDicomSize
      : this.maxImageSize;

    if (buffer.length > maxSize) {
      errors.push(`File quá lớn. Tối đa ${maxSize / 1024 / 1024}MB.`);
    }

    // 2. Detect actual file type from magic bytes
    detectedMimeType = this.detectMimeType(buffer);

    if (!this.allowedMimeTypes.includes(detectedMimeType)) {
      errors.push(
        `Định dạng file không hợp lệ. Chỉ chấp nhận: PNG, JPEG, DICOM.`,
      );
    }

    // 3. Check for potential file extension spoofing
    const extension = originalName.split('.').pop()?.toLowerCase();
    if (extension) {
      if (!this.isExtensionMatchMimeType(extension, detectedMimeType)) {
        errors.push(
          `File extension không khớp với nội dung. Nghi ngờ file giả mạo.`,
        );
      }
    }

    // 4. Generate SHA256 checksum
    const checksum = this.generateChecksum(buffer);

    // 5. Basic virus signature detection (simplified)
    if (this.containsSuspiciousPatterns(buffer)) {
      errors.push('File chứa nội dung đáng ngờ.');
    }

    return {
      isValid: errors.length === 0,
      mimeType: detectedMimeType,
      checksum,
      errors,
    };
  }

  /**
   * Detect MIME type from magic bytes
   */
  private detectMimeType(buffer: Buffer): string {
    // Check for PNG
    if (this.matchesMagicBytes(buffer, this.magicBytes['image/png'], 0)) {
      return 'image/png';
    }

    // Check for JPEG
    if (this.matchesMagicBytes(buffer, this.magicBytes['image/jpeg'], 0)) {
      return 'image/jpeg';
    }

    // Check for DICOM (DICM at offset 128)
    if (buffer.length > 132) {
      const dicomSignature = buffer.slice(128, 132).toString('ascii');
      if (dicomSignature === 'DICM') {
        return 'application/dicom';
      }
    }

    return 'application/octet-stream';
  }

  /**
   * Check if buffer matches magic bytes at given offset
   */
  private matchesMagicBytes(
    buffer: Buffer,
    magic: number[],
    offset: number,
  ): boolean {
    if (buffer.length < offset + magic.length) {
      return false;
    }

    for (let i = 0; i < magic.length; i++) {
      if (buffer[offset + i] !== magic[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a file is DICOM
   */
  private isDicomFile(mimeType: string, buffer: Buffer): boolean {
    if (mimeType === 'application/dicom' || mimeType === 'image/dicom') {
      return true;
    }

    // Check DICM signature
    if (buffer.length > 132) {
      return buffer.slice(128, 132).toString('ascii') === 'DICM';
    }

    return false;
  }

  /**
   * Check if extension matches MIME type
   */
  private isExtensionMatchMimeType(
    extension: string,
    mimeType: string,
  ): boolean {
    const extensionMimeMap: Record<string, string[]> = {
      png: ['image/png'],
      jpg: ['image/jpeg'],
      jpeg: ['image/jpeg'],
      dcm: ['application/dicom', 'image/dicom'],
      dicom: ['application/dicom', 'image/dicom'],
    };

    const allowedMimes = extensionMimeMap[extension];
    if (!allowedMimes) {
      return false;
    }

    return allowedMimes.includes(mimeType);
  }

  /**
   * Generate SHA256 checksum
   */
  generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Basic suspicious pattern detection
   * Note: For production, integrate with ClamAV or similar
   */
  private containsSuspiciousPatterns(buffer: Buffer): boolean {
    // Check for common script patterns that shouldn't be in images
    const suspiciousPatterns = [
      '<script',
      '<?php',
      '<% ',
      'eval(',
      'base64_decode',
      'shell_exec',
    ];

    const content = buffer.toString('latin1');

    for (const pattern of suspiciousPatterns) {
      if (content.includes(pattern)) {
        this.logger.warn(`Suspicious pattern detected in file: ${pattern}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Validate and throw if invalid
   */
  validateOrThrow(
    buffer: Buffer,
    originalName: string,
    declaredMimeType: string,
  ): { mimeType: string; checksum: string } {
    const result = this.validateFile(buffer, originalName, declaredMimeType);

    if (!result.isValid) {
      throw new BadRequestException(result.errors.join(' '));
    }

    return {
      mimeType: result.mimeType,
      checksum: result.checksum,
    };
  }
}

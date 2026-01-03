/**
 * File type configuration for upload validation
 * Centralized config to avoid declaring MAX_FILE_SIZE, allowed mime types in multiple places
 */

export type FileCategory = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'pdf' 
  | 'doc' 
  | 'excel' 
  | 'powerpoint' 
  | 'archive' 
  | 'text' 
  | 'other';

export interface FileTypeConfig {
  maxSize: number;
  allowedMimeTypes: string[];
}

/**
 * Get file type category from mimetype
 */
export const getFileTypeCategory = (mimetype: string): FileCategory => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (['application/pdf'].includes(mimetype)) return 'pdf';
  if (
    [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(mimetype)
  )
    return 'doc';
  if (
    [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(mimetype)
  )
    return 'excel';
  if (
    [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(mimetype)
  )
    return 'powerpoint';
  if (
    [
      // ZIP
      'application/zip',
      'application/x-zip-compressed',
      'application/x-compressed',
      // RAR
      'application/vnd.rar',
      'application/x-rar-compressed',
      // 7Z
      'application/x-7z-compressed',
      // TAR
      'application/x-tar',
      'application/gzip',
    ].includes(mimetype)
  )
    return 'archive';
  if (mimetype === 'text/plain' || mimetype === 'text/csv') return 'text';
  return 'other';
};

/**
 * File type configurations with max size and allowed mime types
 */
export const fileTypeConfigs: Record<Exclude<FileCategory, 'other'>, FileTypeConfig> = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  video: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
    ],
  },
  audio: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a'],
  },
  pdf: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['application/pdf'],
  },
  doc: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  excel: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  powerpoint: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  archive: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      // ZIP
      'application/zip',
      'application/x-zip-compressed',
      'application/x-compressed',
      // RAR
      'application/vnd.rar',
      'application/x-rar-compressed',
      // 7Z
      'application/x-7z-compressed',
      // TAR
      'application/x-tar',
      'application/gzip',
    ],
  },
  text: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['text/plain', 'text/csv'],
  },
};

/**
 * All allowed mime types (flattened from all configs)
 */
export const allAllowedMimeTypes: string[] = Object.values(fileTypeConfigs).flatMap(
  (config) => config.allowedMimeTypes,
);

/**
 * Get config by file category
 */
export const getFileConfig = (category: FileCategory): FileTypeConfig | null => {
  if (category === 'other') return null;
  return fileTypeConfigs[category];
};

/**
 * Validate file by mimetype
 */
export const validateFile = (
  mimetype: string,
  fileSize: number,
): { valid: boolean; category: FileCategory; error?: string } => {
  const category = getFileTypeCategory(mimetype);
  const config = getFileConfig(category);

  if (!config) {
    return { valid: false, category, error: 'Loại file không được hỗ trợ' };
  }

  if (!config.allowedMimeTypes.includes(mimetype)) {
    return { valid: false, category, error: `Định dạng file không hợp lệ cho loại ${category}` };
  }

  if (fileSize > config.maxSize) {
    const maxMB = config.maxSize / (1024 * 1024);
    return { valid: false, category, error: `File vượt quá giới hạn ${maxMB}MB` };
  }

  return { valid: true, category };
};

/**
 * Common size constants for convenience
 */
export const FileSizes = {
  MB_1: 1 * 1024 * 1024,
  MB_5: 5 * 1024 * 1024,
  MB_10: 10 * 1024 * 1024,
  MB_20: 20 * 1024 * 1024,
  MB_50: 50 * 1024 * 1024,
  MB_100: 100 * 1024 * 1024,
} as const;

/**
 * Default limits
 */
export const FileDefaults = {
  MAX_IMAGE_SIZE: fileTypeConfigs.image.maxSize,
  MAX_VIDEO_SIZE: fileTypeConfigs.video.maxSize,
  MAX_AUDIO_SIZE: fileTypeConfigs.audio.maxSize,
  MAX_DOCUMENT_SIZE: fileTypeConfigs.pdf.maxSize,
  MAX_ARCHIVE_SIZE: fileTypeConfigs.archive.maxSize,
  MAX_LICENSE_IMAGES: 5,
  MAX_AVATAR_SIZE: FileSizes.MB_5,
} as const;

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sanitizeHtml from 'sanitize-html';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { CloudinaryService } from '@/modules/cloudinary';

type ImgAttrMap = Record<string, string>;

@Injectable()
export class RichTextService {
  private static readonly MAX_IMAGES = 5;
  private static readonly MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
  private static readonly ALLOWED_MIMES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  private static readonly ALLOWED_TAGS = new Set([
    'p',
    'br',
    'strong',
    'em',
    'u',
    'ul',
    'ol',
    'li',
    'img',
  ]);
  private static readonly ALLOWED_IMG_ATTRS = new Set([
    'src',
    'alt',
    'width',
    'height',
  ]);
  private static readonly DATA_URL_REGEX =
    /data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)/gi;
  private readonly cloudinaryHostPrefix: string;

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    configService: ConfigService,
  ) {
    const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME') ?? '';
    this.cloudinaryHostPrefix = `https://res.cloudinary.com/${cloudName}/`;
  }

  async processPatientNotes(html: string): Promise<string> {
    const sanitized = this.sanitizeHtml(html);
    const withCloudinaryUrls = await this.uploadBase64Images(sanitized);
    return this.enforceFinalImageSrcPolicy(withCloudinaryUrls);
  }

  async processDoctorNotes(html: string): Promise<string> {
    return this.processPatientNotes(html);
  }

  private sanitizeHtml(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: Array.from(RichTextService.ALLOWED_TAGS),
      allowedAttributes: {
        img: Array.from(RichTextService.ALLOWED_IMG_ATTRS),
      },
      allowedSchemes: ['http', 'https', 'data'],
      allowedSchemesByTag: {
        img: ['http', 'https', 'data'],
      },
      allowProtocolRelative: false,
      enforceHtmlBoundary: false,
    });
  }

  private async uploadBase64Images(html: string): Promise<string> {
    const matches = Array.from(html.matchAll(RichTextService.DATA_URL_REGEX));
    if (matches.length > RichTextService.MAX_IMAGES) {
      throw new BadRequestException(
        ERROR_MESSAGES.APPOINTMENT_NOTES_MAX_IMAGES_EXCEEDED,
      );
    }

    let updatedHtml = html;

    for (const match of matches) {
      const fullDataUrl = match[0];
      const mime = (match[1] ?? '').toLowerCase();
      const payload = (match[2] ?? '').replace(/\s/g, '');

      if (!RichTextService.ALLOWED_MIMES.has(mime)) {
        throw new BadRequestException(
          ERROR_MESSAGES.APPOINTMENT_NOTES_UNSUPPORTED_IMAGE_TYPE,
        );
      }

      const buffer = Buffer.from(payload, 'base64');
      if (buffer.length > RichTextService.MAX_IMAGE_SIZE_BYTES) {
        throw new BadRequestException(
          ERROR_MESSAGES.APPOINTMENT_NOTES_IMAGE_TOO_LARGE,
        );
      }

      const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
      const file = {
        fieldname: 'file',
        originalname: `appointment-note-${Date.now()}.${extension}`,
        encoding: '7bit',
        mimetype: mime,
        size: buffer.length,
        buffer,
        destination: '',
        filename: '',
        path: '',
        stream: undefined as unknown as NodeJS.ReadableStream,
      } as Express.Multer.File;

      try {
        const uploaded = await this.cloudinaryService.uploadRichTextImage(
          file,
          'appointment-notes',
        );
        updatedHtml = updatedHtml.replace(fullDataUrl, uploaded.url);
      } catch {
        throw new InternalServerErrorException(
          ERROR_MESSAGES.APPOINTMENT_NOTES_IMAGE_UPLOAD_FAILED,
        );
      }
    }

    return updatedHtml;
  }

  private enforceFinalImageSrcPolicy(html: string): string {
    return html.replace(/<img\b([^>]*)\/?>/gi, (full, rawAttrs: string) => {
      const attrs = this.parseAttributes(rawAttrs);
      const src = attrs.src?.trim() ?? '';

      if (!src) return '';

      if (/^data:image\//i.test(src)) {
        throw new BadRequestException(
          ERROR_MESSAGES.APPOINTMENT_NOTES_IMAGE_UPLOAD_FAILED,
        );
      }

      if (
        /^https:\/\//i.test(src) &&
        src.startsWith(this.cloudinaryHostPrefix)
      ) {
        const filtered: ImgAttrMap = {};
        for (const attrName of Object.keys(attrs)) {
          if (!RichTextService.ALLOWED_IMG_ATTRS.has(attrName)) continue;
          filtered[attrName] = attrs[attrName];
        }
        return this.buildImgTag(filtered);
      }

      if (/^https:\/\//i.test(src)) {
        return '';
      }

      return '';
    });
  }

  private parseAttributes(rawAttrs: string): ImgAttrMap {
    const attrs: ImgAttrMap = {};
    const attrRegex =
      /([a-zA-Z0-9:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(rawAttrs))) {
      const key = match[1].toLowerCase();
      const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();

      if (key.startsWith('on') || key === 'style') continue;
      attrs[key] = value;
    }

    return attrs;
  }

  private buildImgTag(attrs: ImgAttrMap): string {
    if (!attrs.src) return '';
    const parts: string[] = [];

    for (const key of ['src', 'alt', 'width', 'height']) {
      const value = attrs[key];
      if (!value) continue;
      parts.push(`${key}="${this.escapeAttr(value)}"`);
    }

    return `<img ${parts.join(' ')} />`;
  }

  private escapeAttr(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

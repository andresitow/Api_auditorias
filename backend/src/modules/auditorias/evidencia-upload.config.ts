import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

export const EVIDENCIA_IMAGENES_DIR = join(process.cwd(), 'uploads', 'evidencias');
export const EVIDENCIA_IMAGENES_URL_PREFIX = '/uploads/evidencias';

export const EVIDENCIAS_MAX_COUNT = 5;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'message/rfc822',
  'application/vnd.ms-outlook',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
// .msg (Outlook), .eml y algunos formatos de Office a veces llegan con un mimetype
// genérico según el SO/navegador, así que además del mimetype se admite por extensión.
const ALLOWED_EXTENSIONS = ['.msg', '.eml', '.xls', '.xlsx', '.doc', '.docx'];

if (!existsSync(EVIDENCIA_IMAGENES_DIR)) {
  mkdirSync(EVIDENCIA_IMAGENES_DIR, { recursive: true });
}

export const evidenciaImagenMulterOptions = {
  storage: diskStorage({
    destination: EVIDENCIA_IMAGENES_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) && !ALLOWED_EXTENSIONS.includes(ext)) {
      callback(
        new BadRequestException('La evidencia debe ser una imagen (JPG, PNG, WEBP, GIF), un PDF, un correo (EML, MSG), un Excel (XLS, XLSX) o un Word (DOC, DOCX)'),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: EVIDENCIAS_MAX_COUNT },
};
